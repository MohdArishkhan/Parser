import os
from parsers.base import BaseDocumentParser
from parsers.auto import GeminiAutoParser, OpenRouterAutoParser, FallbackAutoParser

class ParserFactory:
    """Factory class to assemble and return the correct parser."""
    
    @staticmethod
    def get_parser(doc_type: str = "auto") -> BaseDocumentParser:
        gemini_key = os.getenv("GEMINI_API_KEY")
        openrouter_key = os.getenv("OPENROUTER_API_KEY")
        
        if not gemini_key:
            raise ValueError("GEMINI_API_KEY is not set in the .env file")
        
        # Instantiate the primary Gemini parser
        primary_parser = GeminiAutoParser(api_key=gemini_key)
        
        # If an OpenRouter key exists, wrap Gemini in the Fallback system
        if openrouter_key:
            fallback_parser = OpenRouterAutoParser(api_key=openrouter_key)
            return FallbackAutoParser(primary=primary_parser, fallback=fallback_parser)
        
        # Otherwise, just return standard Gemini
        return primary_parser