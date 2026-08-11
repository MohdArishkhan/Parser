"""
Shared document preprocessing used by both the API (api.py) and the CLI
batch runner (main.py), so every entry point gets the same page-cleanup
quality before it reaches the parser.
"""

import os
import tempfile

import cv2
import numpy as np
import fitz  # PyMuPDF

# All temp files created anywhere in this app use this prefix, so a cleanup
# sweep of the OS temp directory can identify and remove only files this
# app created — never someone else's unrelated temp files on the same host.
TEMP_FILE_PREFIX = "docparser_"


def rasterize_pdf_page(pdf_path: str, dpi: int = 250, page_number: int = 0) -> str:
    """
    Render one page of a PDF to a JPEG and return the path to a new
    temp file. Always writes to the OS temp directory (never next to the
    source PDF) so a CLI run over an `images/` folder doesn't leave a
    stray .jpg behind that gets picked up as its own document on the
    next run.
    """
    doc = fitz.open(pdf_path)
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


def crop_to_document(input_path: str, min_area_ratio: float = 0.2) -> bool:
    """
    Finds the document's edges in a photo and crops + deskews it to just
    that region, dropping whatever background (table, hands, phone case)
    surrounds it. Overwrites the file in place.

    Returns True if a crop was applied, False if no confident rectangular
    boundary was found — in that case the file is left untouched rather
    than risk cutting into the actual form. This is heuristic: a form
    photographed with almost no visible border, on a low-contrast
    background, or with curled/folded edges may not be detected.
    """
    image = cv2.imread(input_path)
    if image is None:
        return False

    original = image.copy()
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
    document_contour = None

    for contour in contours:
        perimeter = cv2.arcLength(contour, True)
        approx = cv2.approxPolyDP(contour, 0.02 * perimeter, True)
        if len(approx) == 4 and cv2.contourArea(approx) > small_area * min_area_ratio:
            document_contour = approx
            break

    if document_contour is None:
        return False

    corners = document_contour.reshape(4, 2).astype("float32") / scale
    warped = _warp_to_rect(original, corners)

    cv2.imwrite(input_path, warped)
    return True


def enhance_document_image(input_path: str) -> None:
    """
    Whitens the background and enhances text for better AI extraction.
    Removes shadows and lighting gradients typical of mobile phone photos.
    Overwrites the file in place — callers should pass a path to a
    temporary working copy, never the user's original upload.
    """
    img = cv2.imread(input_path, cv2.IMREAD_GRAYSCALE)
    if img is None:
        return

    # 1. Estimate the background illumination. Kernel size scales with the
    #    image's shorter side so a low-res scan and a 4000px phone photo
    #    both get a blur wide enough to wash out text but keep the
    #    lighting gradient.
    short_side = min(img.shape[:2])
    k = max(31, (short_side // 15) | 1)  # keep it odd, GaussianBlur requires that
    bg_illumination = cv2.GaussianBlur(img, (k, k), 0)

    # 2. Divide original by the background. This flattens shadows and
    #    lighting gradients, making the page uniformly bright.
    whitened = cv2.divide(img, bg_illumination, scale=255)

    # 3. Clip the background to a flat ceiling. Otsu picks the cutoff per
    #    image instead of a fixed value tuned to one test photo.
    _, clipped = cv2.threshold(whitened, 0, 255, cv2.THRESH_TRUNC + cv2.THRESH_OTSU)

    # 4. Stretch the range back out: the flattened background becomes true
    #    white, the darkest strokes become true black.
    final = cv2.normalize(clipped, None, 0, 255, cv2.NORM_MINMAX)

    cv2.imwrite(input_path, final)


# NOTE on color: this pipeline converts to grayscale up front (IMREAD_GRAYSCALE),
# which is fine for plain black-ink text/handwriting. If a future document type
# relies on color (colored stamps, ink-color-coded sections), do the divide/
# normalize on the L channel in LAB space instead and merge back with the
# original A/B channels, rather than discarding color entirely.