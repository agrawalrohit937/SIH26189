"""
OCR and PDF FIR Document Ingestion Service
SIH26189 - National Crime Intelligence Grid (Ministry of Home Affairs)

Provides text extraction from scanned image FIRs and digital/scanned PDF files
using pypdf and pytesseract OCR, feeding extracted content seamlessly into the
entity extraction and graph ingestion pipeline.
"""

import io
import os
import logging
from typing import Dict, Any, Optional
import pypdf
from PIL import Image

try:
    import pytesseract
    HAS_PYTESSERACT = True
except ImportError:
    HAS_PYTESSERACT = False

# ==============================================================================
# POLICY CONVENTION:
# Do not add specific legal citations (rule numbers, section numbers, thresholds
# attributed to a named law) to any generated text unless that exact citation
# has been manually verified by a human and hardcoded as a reviewed constant.
# Never let the LLM or any generation logic invent one.
# ==============================================================================

logger = logging.getLogger("ocr_ingestion")


def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """
    Extracts text from PDF bytes.
    1. First attempts native digital text extraction via pypdf.
    2. If text extracted is below threshold (e.g. scanned image PDF), attempts OCR via pytesseract if available.
    """
    extracted_text = ""
    try:
        reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
        for page_idx, page in enumerate(reader.pages):
            page_text = page.extract_text() or ""
            if page_text.strip():
                extracted_text += f"\n--- Page {page_idx + 1} ---\n" + page_text

        # If digital text extracted is meaningful, return it
        if len(extracted_text.strip()) > 50:
            logger.info(f"Successfully extracted {len(extracted_text)} characters using native PDF parser.")
            return extracted_text.strip()

        # If digital extraction yielded little/no text, attempt image-based extraction
        logger.info("PDF appears to be scanned/image-based. Checking OCR engine...")
        if HAS_PYTESSERACT:
            for page_idx, page in enumerate(reader.pages):
                for img_idx, img_obj in enumerate(page.images):
                    try:
                        pil_img = Image.open(io.BytesIO(img_obj.data))
                        ocr_res = pytesseract.image_to_string(pil_img)
                        if ocr_res.strip():
                            extracted_text += f"\n--- Page {page_idx + 1} Image {img_idx + 1} (OCR) ---\n" + ocr_res
                    except Exception as ocr_err:
                        logger.warning(f"OCR extraction failed on page {page_idx+1} image {img_idx+1}: {ocr_err}")
    except Exception as e:
        logger.error(f"Error extracting text from PDF: {e}", exc_info=True)

    return extracted_text.strip()


def extract_text_from_image(image_bytes: bytes) -> str:
    """
    Extracts text directly from an image (PNG, JPG, TIFF) using pytesseract OCR.
    """
    if not HAS_PYTESSERACT:
        logger.warning("pytesseract is not available for image OCR.")
        return ""
    
    try:
        pil_img = Image.open(io.BytesIO(image_bytes))
        text = pytesseract.image_to_string(pil_img)
        logger.info(f"OCR extracted {len(text)} characters from image.")
        return text.strip()
    except Exception as e:
        logger.error(f"Error performing OCR on image: {e}", exc_info=True)
        return ""
