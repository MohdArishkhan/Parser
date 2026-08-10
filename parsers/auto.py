from parsers.base import BaseDocumentParser

class AutoParser(BaseDocumentParser):
    """A unified parser that automatically detects the document type and extracts data."""
    
    def get_prompt(self) -> str:
        return """
        Analyze the provided document and determine its type. 
        It will generally be either a "Tenant Information Form" or an "Aadhaar Card".

        1. If it is a Tenant Information Form, extract:
           - Tenant Details, Parent Details, Address Details, Local Guardian, Academic Details, and Stay Details.
           - Pay attention to handwriting and checkboxes.
        
        2. If it is an Aadhaar Card, extract:
           - Full Name, DOB/YOB, Gender, 12-digit Aadhaar Number, and Address (if back side).

        Return the result STRICTLY as a JSON object with exactly this structure:
        {
            "detected_document_type": "form" | "aadhaar" | "other",
            "extracted_data": { ... }
        }
        """