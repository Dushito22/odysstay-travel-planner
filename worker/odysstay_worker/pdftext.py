import io
import re

from bs4 import BeautifulSoup
from pypdf import PdfReader


def pdf_to_text(data: bytes) -> str:
    reader = PdfReader(io.BytesIO(data))
    pages = []
    for p in reader.pages:
        try:
            pages.append(p.extract_text() or "")
        except Exception:
            pages.append("")
    return clean("\n".join(pages))


def html_to_text(data: bytes) -> str:
    soup = BeautifulSoup(data, "html.parser")
    for t in soup(["script", "style", "nav", "footer", "header", "noscript"]):
        t.decompose()
    return clean(soup.get_text("\n"))


def to_text(data: bytes, content_type: str, url: str = "") -> str:
    if "pdf" in content_type or url.lower().endswith(".pdf") or data[:5] == b"%PDF-":
        return pdf_to_text(data)
    return html_to_text(data)


def clean(text: str) -> str:
    text = text.replace(" ", " ").replace("­", "")
    text = re.sub(r"(\w)-\n(\w)", r"\1\2", text)  # re-join words hyphenated across lines
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def normalize(s: str) -> str:
    """Normalize for quote verification: lowercase, unify quotes/dashes, collapse whitespace."""
    s = s.lower()
    s = s.replace("’", "'").replace("‘", "'").replace("“", '"').replace("”", '"')
    s = s.replace("–", "-").replace("—", "-")
    s = re.sub(r"(\w)-\s+(\w)", r"\1\2", s)
    s = re.sub(r"\s+", " ", s)
    return s.strip()
