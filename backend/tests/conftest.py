"""Pytest configuration: make the backend package importable."""

from __future__ import annotations

import os
import sys

# Ensure ``import app`` works when running pytest from the backend/ directory.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
