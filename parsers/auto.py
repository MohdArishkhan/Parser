import json
import base64
import mimetypes
import fitz  # PyMuPDF for converting PDFs to Images
from google import genai
from google.genai import types
from parsers.base import BaseDocumentParser
from openai import OpenAI

AUTO_PROMPT = """
Analyze the provided document and determine its type. 
It will generally be either a "Tenant Information Form" or an "Aadhaar Card".

Extract the data from the document with extreme precision, especially for handwriting and financial figures.
IF A FIELD IS EMPTY, MISSING, OR CROSSED OUT ON THE FORM, YOU MUST STILL INCLUDE THE KEY IN THE JSON BUT SET ITS VALUE TO "-".

1. If it is a Tenant Information Form, extract:
    - Tenant Details: Name, Email, DOB, and Marital Status. 
      *CRITICAL INSTRUCTION FOR MARITAL STATUS*: Look carefully at the small square boxes to the left of the words "Married" and "Unmarried". Determine precisely which box contains the checkmark/tick and extract that exact value ("Married" or "Unmarried")".
    - Parent Details: Extract Father's name, email, and the combined "Mobile/Aadhaar" box. Do the same for Mother.
    - Address Details: Permanent and Previous address, including Police Station and Pin boxes.
    - Guardian Details: Name/Address block, plus the two separate Mobile number rows, Police Station, and Pin.
    - Academic/Job: Department, Program, Semester, and Institution Name.
    - Stay/Rent: Expected stay, joining date, Room No (Flat/Room/Bed), Quit date, and Rent start date.
      *CRITICAL INSTRUCTION FOR FINANCIAL AMOUNTS*: Read numerical amounts (such as "One month rent advance" and "Refundable security deposit") with extreme care. Double-check commas, decimals, and handwritten numbers to ensure absolute accuracy for business records.

2. If it is an Aadhaar Card, extract:
    - Full Name, DOB/YOB, Gender, 12-digit Aadhaar Number, and Address (if back side).

Return the result STRICTLY as a JSON object with EXACTLY this structure (do not skip any keys):
{
    "detected_document_type": "form" | "aadhaar" | "other",
    "extracted_data": {
        "tenant_name": "",
        "tenant_mobile_no": "",
        "tenant_alternate_no": "",
        "tenant_email": "",
        "tenant_dob": "",
        "tenant_marital_status": "",
        "tenant_id_number": "",
        
        "father_husband_name": "",
        "father_mobile_aadhaar_no": "",
        "father_email": "",
        "mother_name": "",
        "mother_mobile_aadhaar_no": "",
        "mother_email": "",
        
        "permanent_address": "",
        "permanent_police_station": "",
        "permanent_pin": "",
        "previous_address": "",
        "previous_police_station": "",
        "previous_pin": "",
        
        "guardian_name_address": "",
        "guardian_mobile_1": "",
        "guardian_mobile_2": "",
        "guardian_police_station": "",
        "guardian_pin": "",
        
        "academic_department_post": "",
        "academic_program_class": "",
        "academic_semester_year": "",
        "academic_institution_name": "",
        
        "stay_expected_minimum": "",
        "stay_date_of_joining": "",
        "stay_room_flat_bed": "",
        "stay_quit_date": "",
        "rent_one_month_advance": "",
        "rent_refundable_security_deposit": "",
        "rent_start_date": "",
        
        "aadhaar_full_name": "",
        "aadhaar_dob_yob": "",
        "aadhaar_gender": "",
        "aadhaar_number": "",
        "aadhaar_address": ""
    }
}
"""
class GeminiAutoParser(BaseDocumentParser):
    def __init__(self, api_key: str):
        self.client = genai.Client(api_key=api_key)

    def parse(self, file_path: str) -> dict:
        print(f"Parsing {file_path} using GeminiAutoParser...")
        mime_type, _ = mimetypes.guess_type(file_path)
        if not mime_type:
            mime_type = "application/octet-stream"

        with open(file_path, "rb") as f:
            file_bytes = f.read()

        response = self.client.models.generate_content(
            model='gemini-2.5-flash',
            contents=[
                types.Part.from_bytes(data=file_bytes, mime_type=mime_type),
                AUTO_PROMPT
            ],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.1
            )
        )
        return json.loads(response.text)


class OpenRouterAutoParser(BaseDocumentParser):
    def __init__(self, api_key: str):
        # Initializing the standard synchronous OpenAI client targeting OpenRouter
        self.client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=api_key
        )

    def parse(self, file_path: str) -> dict:
        print(f"Parsing {file_path} using OpenRouter (GPT-4o-mini)...")
        
        mime_type, _ = mimetypes.guess_type(file_path)
        
        # Check if it's a PDF and convert it to a JPEG for OpenAI
        if mime_type == "application/pdf":
            print(f"PDF detected for OpenRouter. Converting page 1 to image...")
            doc = fitz.open(file_path)
            page = doc.load_page(0)  # Load the first page
            pix = page.get_pixmap(dpi=150) # High quality render
            img_bytes = pix.tobytes("jpeg")
            base64_image = base64.b64encode(img_bytes).decode('utf-8')
            mime_type = "image/jpeg" # Override MIME type for OpenAI
            doc.close()
        else:
            # If it's already an image, process it normally
            if not mime_type:
                mime_type = "image/jpeg"
                
            with open(file_path, "rb") as image_file:
                base64_image = base64.b64encode(image_file.read()).decode('utf-8')

        response = self.client.chat.completions.create(
            model="openai/gpt-4o-mini",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": AUTO_PROMPT},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{mime_type};base64,{base64_image}"
                            }
                        }
                    ]
                }
            ],
            response_format={"type": "json_object"}
        )
        
        raw_text = response.choices[0].message.content
        clean_text = raw_text.replace("```json", "").replace("```", "").strip()
        return json.loads(clean_text)


def _is_rate_limited(e: Exception) -> bool:
    """
    Prefer a structured status code when the SDK exposes one; fall back to
    string-matching the message. Pure string-matching is fragile — if the
    SDK's exception format changes, the fallback silently stops firing — so
    treat the string check as a safety net, not the primary signal. Worth
    confirming what attribute your installed google-genai / openai SDK
    versions actually set (e.g. `.status_code`, `.code`, or something nested
    under `.response`) and adjusting the getattr calls below to match.
    """
    status = getattr(e, "status_code", None) or getattr(e, "code", None)
    if status == 429:
        return True
    error_msg = str(e).lower()
    return "429" in error_msg or "resource_exhausted" in error_msg or "quota" in error_msg


class FallbackAutoParser(BaseDocumentParser):
    """Wraps two parsers and automatically switches if the primary fails."""

    def __init__(self, primary: BaseDocumentParser, fallback: BaseDocumentParser):
        self.primary = primary
        self.fallback = fallback

    def parse(self, file_path: str) -> dict:
        try:
            # Attempt to use Gemini first
            return self.primary.parse(file_path)
        except Exception as e:
            if _is_rate_limited(e):
                print("Gemini Limit Hit! Switching to OpenRouter Fallback...")
                return self.fallback.parse(file_path)
            # If it's a real error (like a corrupt image), throw it normally
            raise e