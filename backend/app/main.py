"""FastAPI entrypoint for deployment platforms expecting ``backend.app.main``.

This module simply re-exports the fully featured application defined in
``backend.server`` so that the lightweight shim used previously continues to
work while exposing all API routes (team planning, memberships, etc.).
"""

from backend.server import (
    ALLOWED_HEADERS,
    ALLOWED_METHODS,
    ALLOWED_ORIGIN_REGEX,
    ALLOWED_ORIGIN_REGEX_PATTERN,
    ALLOWED_ORIGIN_SET,
    ALLOWED_ORIGINS,
    DEFAULT_ALLOWED_ORIGINS,
    EXPOSE_HEADERS,
    MAX_AGE,
    app as _server_app,
)

app = _server_app

__all__ = [
    "app",
    "ALLOWED_HEADERS",
    "ALLOWED_METHODS",
    "ALLOWED_ORIGIN_REGEX",
    "ALLOWED_ORIGIN_REGEX_PATTERN",
    "ALLOWED_ORIGIN_SET",
    "ALLOWED_ORIGINS",
    "DEFAULT_ALLOWED_ORIGINS",
    "EXPOSE_HEADERS",
    "MAX_AGE",
]
