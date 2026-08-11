import os
import time
import glob
import tempfile
import asyncio
from contextlib import asynccontextmanager
from typing import List
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from dotenv import load_dotenv
from parsers.factory import ParserFactory
from parsers.preprocessing import (
    crop_to_document,
    enhance_document_image,
    rasterize_pdf_page,
    TEMP_FILE_PREFIX,
)

load_dotenv()

ORPHAN_MAX_AGE_SECONDS = 60 * 60       # 1 hour — matches the request
ORPHAN_SWEEP_INTERVAL_SECONDS = 15 * 60  # how often to check


async def _cleanup_orphaned_temp_files():
    """
    Safety net only — the normal cleanup path is the `finally` block in
    process_single_file, which removes each request's temp files within
    seconds of that request finishing. This loop exists purely to catch
    files left behind if a request is killed mid-processing (crash, OOM,
    forced restart) so the `finally` block never gets to run. It only ever
    touches files with this app's TEMP_FILE_PREFIX, never unrelated files
    in the shared OS temp directory.
    """
    pattern = os.path.join(tempfile.gettempdir(), f"{TEMP_FILE_PREFIX}*")
    while True:
        cutoff = time.time() - ORPHAN_MAX_AGE_SECONDS
        for path in glob.glob(pattern):
            try:
                if os.path.getmtime(path) < cutoff:
                    os.remove(path)
            except OSError:
                pass  # already removed, or a race with another worker
        await asyncio.sleep(ORPHAN_SWEEP_INTERVAL_SECONDS)


@asynccontextmanager
async def lifespan(app: FastAPI):
    sweep_task = asyncio.create_task(_cleanup_orphaned_temp_files())
    yield
    sweep_task.cancel()


app = FastAPI(title="Document & PDF Parser API", lifespan=lifespan)
ALLOWED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png", ".webp"}
MAX_UPLOAD_SIZE_BYTES = 25 * 1024 * 1024  # 25 MB per file

app.mount("/frontend", StaticFiles(directory="frontend"), name="frontend")

# Queue so files are processed one at a time, avoiding Free Tier API rate limits.
# NOTE: this Semaphore lives in this process's memory only. If you ever run
# more than one uvicorn/gunicorn worker, each worker gets its own semaphore
# and the free-tier rate limit can be exceeded in aggregate — a shared
# limiter (e.g. Redis) would be needed at that point.
queue_lock = asyncio.Semaphore(1)

# Build the parser once at startup instead of on every request, and fail
# fast here if the required key is missing rather than on the first upload.
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise RuntimeError(
        "GEMINI_API_KEY is not set. Add it to your .env file before starting the server."
    )

parser = ParserFactory.get_parser(doc_type="auto", api_key=GEMINI_API_KEY)


@app.get("/")
async def serve_ui():
    return FileResponse("frontend/index.html")


async def process_single_file(file: UploadFile) -> dict:
    ext = os.path.splitext(file.filename)[1].lower()

    if ext not in ALLOWED_EXTENSIONS:
        return {"file_name": file.filename, "status": "error", "error": f"Unsupported type '{ext}'"}

    temp_paths = []
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext, prefix=TEMP_FILE_PREFIX) as temp_file:
            temp_path = temp_file.name
            temp_paths.append(temp_path)

            # Stream the upload to disk in chunks instead of buffering the
            # whole thing into memory first, so an oversized file is caught
            # (and the read stopped early) rather than fully landing in RAM
            # before we even get to check its size.
            size = 0
            while chunk := await file.read(1024 * 1024):  # 1 MB at a time
                size += len(chunk)
                if size > MAX_UPLOAD_SIZE_BYTES:
                    return {
                        "file_name": file.filename,
                        "status": "error",
                        "error": f"File exceeds the {MAX_UPLOAD_SIZE_BYTES // (1024 * 1024)} MB limit",
                    }
                temp_file.write(chunk)

        # Rasterize PDFs to an image first, so every file (PDF or photo)
        # goes through the same enhancement and the parser always sees a
        # plain image.
        if ext == ".pdf":
            image_path = await asyncio.to_thread(rasterize_pdf_page, temp_path)
            temp_paths.append(image_path)
        else:
            image_path = temp_path

        # Crop out the background and deskew, so the parser sees just the
        # form/card itself rather than the table, hands, etc. Falls back
        # to the uncropped image if no confident boundary is found.
        await asyncio.to_thread(crop_to_document, image_path)

        # Clean up shadows/contrast before parsing. This is CPU-bound
        # OpenCV work, so it runs in a thread instead of blocking the
        # event loop (and every other in-flight request) while it runs.
        await asyncio.to_thread(enhance_document_image, image_path)

        # --- QUEUE CONTROL ---
        async with queue_lock:
            # The parser automatically handles the Gemini -> OpenRouter routing natively
            result = await asyncio.to_thread(parser.parse, image_path)

            # 4-second delay to keep the Free Tier APIs stable
            await asyncio.sleep(4)
        # ---------------------

        return {"file_name": file.filename, "status": "success", "data": result}

    except Exception as e:
        return {"file_name": file.filename, "status": "error", "error": str(e)}

    finally:
        for path in temp_paths:
            if os.path.exists(path):
                os.remove(path)

@app.post("/parse-batch")
async def parse_batch(files: List[UploadFile] = File(...)):
    # Launch all tasks concurrently; the queue_lock forces them through sequentially.
    tasks = [process_single_file(file) for file in files]
    batch_results = await asyncio.gather(*tasks)

    return {
        "batch_status": "complete",
        "total_processed": len(files),
        "results": batch_results,
    }