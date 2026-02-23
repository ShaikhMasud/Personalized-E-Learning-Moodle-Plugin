import os
import re
import pickle
import pdfplumber
from pdf2image import convert_from_path
import pytesseract
from sentence_transformers import SentenceTransformer
import faiss

PDF_DIR = "pdfs"
INDEX_FILE = "faiss.index"
CHUNKS_FILE = "chunks.pkl"

model = SentenceTransformer("paraphrase-MiniLM-L3-v2")


def extract_text(pdf_path):
    text = ""
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            t = page.extract_text()
            if t:
                text += t + "\n"
    return text


from pdf2image import convert_from_path
import pytesseract

from pdf2image import convert_from_path
import pytesseract

POPPLER_PATH = r"C:\poppler\Library\bin"
pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

def extract_images_text(pdf_path):
    text = ""
    try:
        images = convert_from_path(
            pdf_path,
            dpi=300,
            poppler_path=POPPLER_PATH
        )
        for img in images:
            ocr = pytesseract.image_to_string(img, lang="eng")
            if ocr.strip():
                text += ocr + "\n"
    except Exception as e:
        print(f"❌ OCR failed for {pdf_path}: {e}")
        raise e   # ← IMPORTANT: DO NOT SILENTLY SKIP
    return text

def structure_text(raw_text):
    lines = raw_text.splitlines()
    current_unit = "UNKNOWN"
    current_section = "UNKNOWN"
    structured = []

    for line in lines:
        unit_match = re.search(r"UNIT\s+(\d+)", line, re.I)
        section_match = re.search(r"(section\s*)?(\d+(\.\d+)+)", line, re.I)

        if unit_match:
            current_unit = unit_match.group(1)

        if section_match:
            current_section = section_match.group(2)

        structured.append(
            f"[UNIT {current_unit} | SECTION {current_section}] {line}"
        )

    return "\n".join(structured)


def split_by_section(text):
    return re.split(
        r"\n(?=\[UNIT\s+\d+\s+\|\s+SECTION\s+[\d\.]+\])",
        text
    )


def chunk_text(text, size=700, overlap=150):
    chunks = []
    start = 0
    while start < len(text):
        chunks.append(text[start:start + size])
        start += size - overlap
    return chunks


all_chunks = []

for file in os.listdir(PDF_DIR):
    if file.endswith(".pdf"):
        print(f"📄 Processing {file}")
        path = os.path.join(PDF_DIR, file)

        text = extract_text(path)
        ocr_text = extract_images_text(path)
        combined = text + "\n" + ocr_text

        structured = structure_text(combined)
        structured = f"SOURCE: {file}\n{structured}"

        sections = split_by_section(structured)
        for sec in sections:
            all_chunks.extend(chunk_text(sec))

print(f"✂️ Total chunks created: {len(all_chunks)}")

embeddings = model.encode(all_chunks, show_progress_bar=True)
index = faiss.IndexFlatL2(embeddings.shape[1])
index.add(embeddings)

faiss.write_index(index, INDEX_FILE)

with open(CHUNKS_FILE, "wb") as f:
    pickle.dump(all_chunks, f)

print("✅ Ingestion complete")