"""Root entry-point shim.

Some platforms (including Vercel's Python web service) look for the ASGI app as
``main:app`` at the service root. The real application lives in ``app/main.py``;
this module simply re-exports it.

    uvicorn main:app        # equivalent to: uvicorn app.main:app
"""

from app.main import app

__all__ = ["app"]
