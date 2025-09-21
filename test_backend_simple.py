#!/usr/bin/env python3
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from backend.app.main import app
import uvicorn
import logging

# Enable detailed logging
logging.basicConfig(level=logging.DEBUG)
uvicorn_logger = logging.getLogger("uvicorn")
uvicorn_logger.setLevel(logging.DEBUG)

# Add exception handler
@app.exception_handler(Exception)
async def exception_handler(request, exc):
    import traceback
    error_msg = f"Error: {exc}\n{traceback.format_exc()}"
    print(error_msg)
    return {"detail": error_msg}, 500

if __name__ == "__main__":
    print("Starting backend with debug mode...")
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="debug")