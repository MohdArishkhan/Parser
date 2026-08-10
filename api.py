# import os
# import tempfile
# import asyncio
# from typing import List
# from fastapi import FastAPI, UploadFile, File, HTTPException
# from fastapi.staticfiles import StaticFiles
# from fastapi.responses import FileResponse
# from dotenv import load_dotenv
# from parsers.factory import ParserFactory

# load_dotenv()

# app = FastAPI(title="Document & PDF Parser API")
# ALLOWED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png", ".webp"}

# app.mount("/frontend", StaticFiles(directory="frontend"), name="frontend")

# # yeh queue banaye hai mene so that each file ko sequentially process kare, taaki Free Tier APIs ke rate limits na hit ho!!!
# queue_lock = asyncio.Semaphore(1)


# @app.get("/")
# async def serve_ui():
#     return FileResponse("frontend/index.html")


# async def process_single_file(file: UploadFile, parser):
#     ext = os.path.splitext(file.filename)[1].lower()
    
#     if ext not in ALLOWED_EXTENSIONS:
#         return {"file_name": file.filename, "status": "error", "error": f"Unsupported type '{ext}'"}

#     try:
#         with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as temp_file:
#             content = await file.read()
#             temp_file.write(content)
#             temp_path = temp_file.name

#         # --- QUEUE CONTROL ---
#         async with queue_lock:
            
#             # The parser automatically handles the Gemini -> OpenRouter routing natively!
#             result = await asyncio.to_thread(parser.parse, temp_path)
            
#             # 4-second delay to keep the Free Tier APIs stable
#             await asyncio.sleep(4)
#         # ---------------------

#         os.remove(temp_path)
#         return {"file_name": file.filename, "status": "success", "data": result}

#     except Exception as e:
#         if 'temp_path' in locals() and os.path.exists(temp_path):
#             os.remove(temp_path)
#         return {"file_name": file.filename, "status": "error", "error": str(e)}


# @app.post("/parse-batch")
# async def parse_batch(files: List[UploadFile] = File(...)):
#     try:
#         # Ask the Factory for a parser; it automatically builds the fallback system
#         parser = ParserFactory.get_parser(doc_type="auto")
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e))

#     # Launch all tasks concurrently; the queue_lock forces them through sequentially
#     tasks = [process_single_file(file, parser) for file in files]
#     batch_results = await asyncio.gather(*tasks)

#     return {
#         "batch_status": "complete",
#         "total_processed": len(files),
#         "results": batch_results
#     }








import os
import tempfile
import asyncio
from typing import List
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from dotenv import load_dotenv
from parsers.factory import ParserFactory
import cv2
import numpy as np  # Added for matrix operations

load_dotenv()

app = FastAPI(title="Document & PDF Parser API")
ALLOWED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png", ".webp"}

app.mount("/frontend", StaticFiles(directory="frontend"), name="frontend")

# Semaphore queue to process each file sequentially, avoiding Free Tier API rate limits
queue_lock = asyncio.Semaphore(1)


@app.get("/")
async def serve_ui():
    return FileResponse("frontend/index.html")


def enhance_document_image(input_path: str):
    """
    Whitens the background and enhances text for better AI extraction.
    Removes shadows and gradients typical of mobile phone photos.
    """
    img = cv2.imread(input_path, cv2.IMREAD_GRAYSCALE)
    if img is None:
        return

    # 1. Estimate the background illumination
    # A large blur blends the text away, leaving only the shadows and lighting gradients.
    bg_illumination = cv2.GaussianBlur(img, (99, 99), 0)

    # 2. Divide original by the background
    # This acts as a flattening filter: it neutralizes shadows and makes the page uniformly bright.
    whitened = cv2.divide(img, bg_illumination, scale=255)

    # 3. Enhance Contrast (Make text pop)
    # TRUNC makes any pixel lighter than 210 pure white, preserving anti-aliased edges on text.
    _, final = cv2.threshold(whitened, 210, 255, cv2.THRESH_TRUNC)
    
    # NORM_MINMAX stretches the darkest pixels down to 0 (pure black)
    final = cv2.normalize(final, None, 0, 255, cv2.NORM_MINMAX)

    cv2.imwrite(input_path, final)


async def process_single_file(file: UploadFile, parser):
    ext = os.path.splitext(file.filename)[1].lower()
    
    if ext not in ALLOWED_EXTENSIONS:
        return {"file_name": file.filename, "status": "error", "error": f"Unsupported type '{ext}'"}

    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as temp_file:
            content = await file.read()
            temp_file.write(content)
            temp_path = temp_file.name

        # --- IMAGE ENHANCEMENT ---
        # Automatically clean up images (shadows, contrast) before parsing
        if ext in {".jpg", ".jpeg", ".png", ".webp"}:
            enhance_document_image(temp_path)
        # -------------------------

        # --- QUEUE CONTROL ---
        async with queue_lock:
            
            # The parser automatically handles the Gemini -> OpenRouter routing natively
            result = await asyncio.to_thread(parser.parse, temp_path)
            
            # 4-second delay to keep the Free Tier APIs stable
            await asyncio.sleep(4)
        # ---------------------

        os.remove(temp_path)
        return {"file_name": file.filename, "status": "success", "data": result}

    except Exception as e:
        if 'temp_path' in locals() and os.path.exists(temp_path):
            os.remove(temp_path)
        return {"file_name": file.filename, "status": "error", "error": str(e)}


@app.post("/parse-batch")
async def parse_batch(files: List[UploadFile] = File(...)):
    try:
        # Ask the Factory for a parser; it automatically builds the fallback system
        parser = ParserFactory.get_parser(doc_type="auto")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    # Launch all tasks concurrently; the queue_lock forces them through sequentially
    tasks = [process_single_file(file, parser) for file in files]
    batch_results = await asyncio.gather(*tasks)

    return {
        "batch_status": "complete",
        "total_processed": len(files),
        "results": batch_results
    }