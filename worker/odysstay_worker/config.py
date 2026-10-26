import os
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
# Never put this key in the app or in git. It bypasses row-level security.
SUPABASE_SERVICE_KEY = (os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_SECRET_KEY", "")).strip()
def _clean(v: str) -> str:
    """Pasted secrets often carry spaces, newlines or quotes."""
    return v.strip().strip('"').strip("'").strip()


ANTHROPIC_API_KEY = _clean(os.environ.get("ANTHROPIC_API_KEY", ""))
MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-5-5")
CONTACT = os.environ.get("WORKER_CONTACT", "")

DATA_DIR = Path(os.environ.get("WORKER_DATA", ROOT / "data"))
CACHE_DIR = DATA_DIR / "cache"
USER_AGENT = "OdysstayBot/0.1 (public property notices" + (f"; contact {CONTACT}" if CONTACT else "") + ")"
HOST_DELAY = float(os.environ.get("WORKER_HOST_DELAY", "1.5"))

for d in (DATA_DIR, CACHE_DIR):
    d.mkdir(parents=True, exist_ok=True)


def require(*names: str):
    missing = [n for n in names if not globals().get(n)]
    if missing:
        raise SystemExit(f"Missing in worker/.env: {', '.join(missing)}")


def key_shape(v: str) -> str:
    """Safe description of a key for logs: its first 10 characters and length, never the key."""
    return f"{v[:10]}... ({len(v)} chars)" if v else "missing"
