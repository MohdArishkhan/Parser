"""
Shared document preprocessing used by both the API (api.py) and the CLI
batch runner (main.py), so every entry point gets the same page-cleanup
quality before it reaches the parser.
"""

import os
import logging
import tempfile

import cv2
import numpy as np
import fitz  # PyMuPDF

logger = logging.getLogger(__name__)

# All temp files created anywhere in this app use this prefix, so a cleanup
# sweep of the OS temp directory can identify and remove only files this
# app created — never someone else's unrelated temp files on the same host.
TEMP_FILE_PREFIX = "docparser_"

# How long to sleep after each LLM call to stay under free-tier rate limits.
# Shared by api.py and main.py so both entry points honor the same budget
# instead of drifting out of sync.
RATE_LIMIT_DELAY_SECONDS = 4

# Longest side (px) an image is allowed to be before being sent to the LLM.
# Both Gemini and OpenAI-compatible vision models tile/bill by resolution,
# and past this point there's no extraction-quality gain for text/handwriting
# — only extra cost and latency. Applied after crop+enhance, right before
# the file is handed to the parser.
MAX_IMAGE_DIMENSION = 2000


def rasterize_pdf_page(pdf_path: str, dpi: int = 250, page_number: int = 0) -> str:
    """
    Render one page of a PDF to a JPEG and return the path to a new
    temp file. Always writes to the OS temp directory (never next to the
    source PDF) so a CLI run over an `images/` folder doesn't leave a
    stray .jpg behind that gets picked up as its own document on the
    next run.

    NOTE: only `page_number` (default 0) is rasterized. If a source PDF
    has multiple pages (e.g. a scanned two-page form, or an Aadhaar
    front+back saved as one PDF), everything past that page is silently
    dropped. Log a heads-up so it isn't a silent surprise.
    """
    doc = fitz.open(pdf_path)
    if doc.page_count > 1:
        logger.warning(
            "%s has %d pages — only page %d is being rasterized; "
            "the rest will be ignored by the parser.",
            pdf_path, doc.page_count, page_number,
        )
    page = doc.load_page(page_number)
    pix = page.get_pixmap(dpi=dpi)

    fd, image_path = tempfile.mkstemp(suffix=".jpg", prefix=TEMP_FILE_PREFIX)
    os.close(fd)
    pix.save(image_path)
    doc.close()
    return image_path


def _order_corners(pts: np.ndarray) -> np.ndarray:
    """Order 4 points as top-left, top-right, bottom-right, bottom-left."""
    rect = np.zeros((4, 2), dtype="float32")
    s = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)]        # top-left: smallest x+y
    rect[2] = pts[np.argmax(s)]        # bottom-right: largest x+y
    diff = np.diff(pts, axis=1)
    rect[1] = pts[np.argmin(diff)]
    rect[3] = pts[np.argmax(diff)]
    return rect


def _warp_to_rect(image: np.ndarray, corners: np.ndarray) -> np.ndarray:
    """Perspective-warp the quadrilateral defined by `corners` into a flat rectangle."""
    tl, tr, br, bl = _order_corners(corners)

    width = max(int(np.linalg.norm(br - bl)), int(np.linalg.norm(tr - tl)))
    height = max(int(np.linalg.norm(tr - br)), int(np.linalg.norm(tl - bl)))

    dst = np.array(
        [[0, 0], [width - 1, 0], [width - 1, height - 1], [0, height - 1]],
        dtype="float32",
    )
    matrix = cv2.getPerspectiveTransform(np.array([tl, tr, br, bl], dtype="float32"), dst)
    return cv2.warpPerspective(image, matrix, (width, height))


def _find_document_corners(image: np.ndarray, min_area_ratio: float) -> np.ndarray | None:
    """
    Finds the document's edges in a photo. Returns the 4 corner points
    (in the original image's coordinate space) or None if no confident
    rectangular boundary was found.
    """
    orig_h, orig_w = image.shape[:2]

    # Detect edges on a small, fixed-height copy — faster and more stable
    # than running Canny on a full-resolution phone photo — then map the
    # found corners back to the original resolution.
    scale = 700.0 / orig_h if orig_h > 700 else 1.0
    small = cv2.resize(image, (int(orig_w * scale), int(orig_h * scale)))

    gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blurred, 50, 150)
    edges = cv2.dilate(edges, np.ones((5, 5), np.uint8), iterations=1)

    contours, _ = cv2.findContours(edges, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    contours = sorted(contours, key=cv2.contourArea, reverse=True)[:5]

    small_area = small.shape[0] * small.shape[1]

    for contour in contours:
        perimeter = cv2.arcLength(contour, True)
        approx = cv2.approxPolyDP(contour, 0.02 * perimeter, True)
        if len(approx) == 4 and cv2.contourArea(approx) > small_area * min_area_ratio:
            return approx.reshape(4, 2).astype("float32") / scale

    return None


def _crop_to_document_array(image: np.ndarray, min_area_ratio: float = 0.2) -> tuple[np.ndarray, bool]:
    """
    In-memory version of the crop step: takes a loaded BGR image, returns
    (possibly-cropped image, was_cropped). This is heuristic — a form
    photographed with almost no visible border, on a low-contrast
    background, or with curled/folded edges may not be detected, in which
    case the original image is returned untouched rather than risk cutting
    into the actual form.
    """
    corners = _find_document_corners(image, min_area_ratio)
    if corners is None:
        return image, False
    return _warp_to_rect(image, corners), True


def _enhance_array(gray: np.ndarray) -> np.ndarray:
    """
    In-memory version of the enhancement step: whitens the background and
    boosts text contrast, removing shadows and lighting gradients typical
    of mobile phone photos. Expects (and returns) a single-channel image.
    """
    # 1. Estimate the background illumination. Kernel size scales with the
    #    image's shorter side so a low-res scan and a 4000px phone photo
    #    both get a blur wide enough to wash out text but keep the
    #    lighting gradient.
    short_side = min(gray.shape[:2])
    k = max(31, (short_side // 15) | 1)  # keep it odd, GaussianBlur requires that
    bg_illumination = cv2.GaussianBlur(gray, (k, k), 0)

    # 2. Divide original by the background. This flattens shadows and
    #    lighting gradients, making the page uniformly bright.
    whitened = cv2.divide(gray, bg_illumination, scale=255)

    # 3. Clip the background to a flat ceiling. Otsu picks the cutoff per
    #    image instead of a fixed value tuned to one test photo.
    _, clipped = cv2.threshold(whitened, 0, 255, cv2.THRESH_TRUNC + cv2.THRESH_OTSU)

    # 4. Stretch the range back out: the flattened background becomes true
    #    white, the darkest strokes become true black.
    return cv2.normalize(clipped, None, 0, 255, cv2.NORM_MINMAX)


def _resize_if_needed(image: np.ndarray, max_dimension: int) -> np.ndarray:
    """Downscale so the longest side is at most `max_dimension`. No-op if already smaller."""
    h, w = image.shape[:2]
    longest = max(h, w)
    if longest <= max_dimension:
        return image
    scale = max_dimension / longest
    new_size = (int(w * scale), int(h * scale))
    return cv2.resize(image, new_size, interpolation=cv2.INTER_AREA)


def preprocess_document_image(
    input_path: str,
    min_area_ratio: float = 0.2,
    max_dimension: int = MAX_IMAGE_DIMENSION,
) -> bool:
    """
    Full cleanup pipeline in a single disk read/write: crop to the
    document boundary, deskew, remove shadows/lighting gradients, and
    downscale if larger than needed for extraction. Overwrites the file
    in place — callers should pass a path to a temporary working copy,
    never the user's original upload.

    Replaces the old two-pass crop_to_document() + enhance_document_image()
    combo (which each did their own imread/imwrite) with one imread and
    one imwrite, cutting the preprocessing I/O in half.

    Returns True if a crop was applied, False if no confident rectangular
    boundary was found (the image is still enhanced + resized either way).
    """
    image = cv2.imread(input_path)
    if image is None:
        logger.warning("Could not read image for preprocessing: %s", input_path)
        return False

    cropped, was_cropped = _crop_to_document_array(image, min_area_ratio)
    gray = cv2.cvtColor(cropped, cv2.COLOR_BGR2GRAY)
    enhanced = _enhance_array(gray)
    final = _resize_if_needed(enhanced, max_dimension)

    cv2.imwrite(input_path, final)
    return was_cropped


# Backwards-compatible wrappers, in case anything outside this app still
# imports the old two-step functions directly. Prefer preprocess_document_image
# for new code — it does the same work in one pass instead of two.
def crop_to_document(input_path: str, min_area_ratio: float = 0.2) -> bool:
    image = cv2.imread(input_path)
    if image is None:
        return False
    cropped, was_cropped = _crop_to_document_array(image, min_area_ratio)
    if was_cropped:
        cv2.imwrite(input_path, cropped)
    return was_cropped


def enhance_document_image(input_path: str) -> None:
    img = cv2.imread(input_path, cv2.IMREAD_GRAYSCALE)
    if img is None:
        return
    cv2.imwrite(input_path, _enhance_array(img))


# NOTE on color: this pipeline converts to grayscale up front, which is
# fine for plain black-ink text/handwriting. If a future document type
# relies on color (colored stamps, ink-color-coded sections), do the
# divide/normalize on the L channel in LAB space instead and merge back
# with the original A/B channels, rather than discarding color entirely.
