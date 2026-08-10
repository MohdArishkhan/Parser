# Form Aadhaar Parser

A simple Python project for parsing document images using the Google Gemini API.

## Project Structure

- `main.py` - entry point for running the app
- `parsers/` - parser implementations and factory
- `images/` - place your input images here
- `outputs/` - generated JSON results
- `.env` - API key storage

## Setup

1. Create and activate a Python virtual environment
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Add your Gemini API key to `.env`:
   ```env
   GEMINI_API_KEY=your_key
   OPENROUTER_API_KEY
   ```

## Run

Run the application with:

```bash
python main.py
```

## Notes
-start you code from this directory :  C:\Users\LENOVO\Desktop\Parser\form_aadhaar_parser>uvicorn api:app --reload
- Put your input images in the `images/` folder.
- Parsed results will be saved in the `outputs/` folder.
