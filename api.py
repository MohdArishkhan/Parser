import os
import tempfile
import asyncio
from typing import List
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from dotenv import load_dotenv
from parsers.factory import ParserFactory

load_dotenv()

app = FastAPI(title="Document & PDF Parser API")
ALLOWED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png", ".webp"}

# Mount the UI
app.mount("/frontend", StaticFiles(directory="frontend"), name="frontend")

@app.get("/")
async def serve_ui():
    return FileResponse("frontend/index.html")

# Helper function to process ONE file in the background
async def process_single_file(file: UploadFile, parser):
    ext = os.path.splitext(file.filename)[1].lower()
    
    if ext not in ALLOWED_EXTENSIONS:
        return {"file_name": file.filename, "status": "error", "error": f"Unsupported type '{ext}'"}

    try:
        # Save temp file
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as temp_file:
            content = await file.read()
            temp_file.write(content)
            temp_path = temp_file.name

        # FIX: Run the parser in a separate async thread so it processes parallel to other files!
        result = await asyncio.to_thread(parser.parse, temp_path)
        
        os.remove(temp_path)
        return {"file_name": file.filename, "status": "success", "data": result}
    
    except Exception as e:
        if 'temp_path' in locals() and os.path.exists(temp_path):
            os.remove(temp_path)
        return {"file_name": file.filename, "status": "error", "error": str(e)}


@app.post("/parse-batch")
async def parse_batch(files: List[UploadFile] = File(...)):
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="Server Error: GEMINI_API_KEY is not set.")

    parser = ParserFactory.get_parser(doc_type="auto", api_key=api_key)
    
    # Launch all files to Gemini simultaneously using asyncio.gather
    tasks = [process_single_file(file, parser) for file in files]
    batch_results = await asyncio.gather(*tasks)

    return {
        "batch_status": "complete",
        "total_processed": len(files),
        "results": batch_results
    }