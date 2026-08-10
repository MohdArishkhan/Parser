import json
import mimetypes
from abc import ABC, abstractmethod
from google import genai
from google.genai import types

class BaseDocumentParser(ABC):
    """Abstract base class for all document parsers."""
    
    def __init__(self, api_key: str):
        self.client = genai.Client(api_key=api_key)

    @abstractmethod
    def get_prompt(self) -> str:
        """Returns the specific prompt instructions for the document type."""
        pass

    def parse(self, file_path: str) -> dict:
        """Loads the image or PDF, sends it to Vision AI, and returns JSON."""
        print(f"Parsing {file_path} using {self.__class__.__name__}...")
        
        # 1. Dynamically detect MIME type (e.g., application/pdf, image/png, image/jpeg)
        mime_type, _ = mimetypes.guess_type(file_path)
        if not mime_type:
            mime_type = "application/octet-stream"
        
        print(f"Detected MIME type: {mime_type}")

        # 2. Read the file bytes
        with open(file_path, "rb") as f:
            file_bytes = f.read()

        # 3. Send file (PDF or Image) + Prompt to Gemini
        response = self.client.models.generate_content(
            model='gemini-2.5-flash',
            contents=[
                types.Part.from_bytes(data=file_bytes, mime_type=mime_type),
                self.get_prompt()
            ],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.1
            )
        )
        
        return json.loads(response.text)