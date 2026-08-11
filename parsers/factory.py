import os
import threading
from typing import Callable, Dict, Optional

from parsers.base import BaseDocumentParser
from parsers.auto import GeminiAutoParser, OpenRouterAutoParser, FallbackAutoParser


class ParserFactory:
    """
    Registry-based factory for document parsers.

    New doc types are added by calling `ParserFactory.register(...)` with a
    builder function — this class itself never needs to change (open/closed).
    Built parsers are cached per (doc_type, api_key) since a parser is
    stateless and safe to reuse across requests.
    """

    _builders: Dict[str, Callable[[Optional[str]], BaseDocumentParser]] = {}
    _cache: Dict[str, BaseDocumentParser] = {}
    _lock = threading.Lock()

    @classmethod
    def register(cls, doc_type: str, builder: Callable[[Optional[str]], BaseDocumentParser]) -> None:
        cls._builders[doc_type] = builder

    @classmethod
    def get_parser(cls, doc_type: str = "auto", api_key: Optional[str] = None) -> BaseDocumentParser:
        if doc_type not in cls._builders:
            available = ", ".join(sorted(cls._builders)) or "none registered"
            raise ValueError(f"Unknown doc_type '{doc_type}'. Available: {available}")

        cache_key = f"{doc_type}:{api_key or 'env'}"
        if cache_key in cls._cache:
            return cls._cache[cache_key]

        with cls._lock:
            if cache_key not in cls._cache:  # re-check: another thread may have built it first
                cls._cache[cache_key] = cls._builders[doc_type](api_key)
            return cls._cache[cache_key]


def _build_auto_parser(api_key: Optional[str] = None) -> BaseDocumentParser:
    """Assembles the Gemini-primary / OpenRouter-fallback 'auto' parser."""
    gemini_key = api_key or os.getenv("GEMINI_API_KEY")
    openrouter_key = os.getenv("OPENROUTER_API_KEY")

    if not gemini_key:
        raise ValueError("GEMINI_API_KEY is not set in the .env file")

    primary_parser = GeminiAutoParser(api_key=gemini_key)

    if openrouter_key:
        fallback_parser = OpenRouterAutoParser(api_key=openrouter_key)
        return FallbackAutoParser(primary=primary_parser, fallback=fallback_parser)

    return primary_parser


# Registered at import time so ParserFactory.get_parser("auto") keeps working
# exactly as before for existing callers.
ParserFactory.register("auto", _build_auto_parser)
