# config.py
import os
from pathlib import Path

# Load .env from the backend directory — works regardless of launch CWD
try:
    from dotenv import load_dotenv
    _env_path = Path(__file__).parent / ".env"
    load_dotenv(dotenv_path=_env_path)
except ImportError:
    pass  # python-dotenv not installed; rely on OS environment variables



DB_CONFIG = {
    "host":     os.environ.get("DB_HOST", "localhost"),
    "user":     os.environ.get("DB_USER", "root"),
    "password": os.environ.get("DB_PASSWORD", ""),      # set DB_PASSWORD in .env
    "database": os.environ.get("DB_NAME", "doct_db"),
    "port":     int(os.environ.get("DB_PORT", "3306")),
}

_BASE_DIR = os.path.abspath(os.path.dirname(__file__))
UPLOAD_FOLDER = os.environ.get("UPLOAD_FOLDER", os.path.join(_BASE_DIR, "static", "uploads"))
ALLOWED_EXTENSIONS = {"pdf", "png", "jpg", "jpeg"}
SECRET_KEY = os.environ.get("SECRET_KEY", "replace_this_with_a_random_secret")

# AI / Chatbot
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")

# MongoDB
MONGO_URI = os.environ.get("MONGO_URI", "mongodb://localhost:27017")
MONGO_DB = os.environ.get("MONGO_DB", "medical_system")
