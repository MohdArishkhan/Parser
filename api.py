import os
import tempfile
import asyncio
from typing import List
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from dotenv import load_dotenv
from parsers.factory import ParserFactory
from parsers.preprocessing import crop_to_document, enhance_document_image, rasterize_pdf_page

load_dotenv()

app = FastAPI(title="Document & PDF Parser API")
ALLOWED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png", ".webp"}

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
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as temp_file:
            content = await file.read()
            temp_file.write(content)
            temp_path = temp_file.name
        temp_paths.append(temp_path)

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
