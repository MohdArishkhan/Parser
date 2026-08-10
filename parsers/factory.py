from parsers.base import BaseDocumentParser
from parsers.auto import AutoParser

class ParserFactory:
    """Factory class to generate the correct parser."""
    
    @staticmethod
    def get_parser(doc_type: str, api_key: str) -> BaseDocumentParser:
        return AutoParser(api_key)