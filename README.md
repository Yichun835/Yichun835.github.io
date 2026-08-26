# Personal homepage

This repository contains the generated static files for the personal homepage.

## Local preview

Use the project-managed `uv` environment:

```bash
uv sync
uv run python tools/preview.py
```

Then open http://127.0.0.1:8000. Stop the preview with `Ctrl+C`.

## Visual customization

The shared visual design lives in `css/aurora.css`. The lightweight particle
background and homepage embellishments live in `js/aurora.js`.
