from abc import ABC, abstractmethod

class BaseDocumentParser(ABC):
    """Abstract base interface for all document parsers."""
    
    @abstractmethod
    def parse(self, file_path: str) -> dict:
        """Parses the document and returns a structured dictionary."""
        pass