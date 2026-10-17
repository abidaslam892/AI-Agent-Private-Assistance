import os
import csv
import logging
from typing import List, Dict, Any
import pypdf
import docx
import pandas as pd

logger = logging.getLogger(__name__)

class DocumentParser:
    @staticmethod
    def parse_file(file_path: str, filename: str) -> List[Dict[str, Any]]:
        """
        Parse file into structured sections with page numbers and metadata.
        Returns a list of dicts: [{'content': str, 'page_number': int | None, 'section': str | None, 'metadata': dict}]
        """
        ext = os.path.splitext(filename)[1].lower()
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")

        if ext == ".pdf":
            return DocumentParser._parse_pdf(file_path)
        elif ext in [".docx", ".doc"]:
            return DocumentParser._parse_docx(file_path)
        elif ext == ".csv":
            return DocumentParser._parse_csv(file_path)
        elif ext in [".xlsx", ".xls"]:
            return DocumentParser._parse_xlsx(file_path)
        elif ext in [".txt", ".md", ".markdown"]:
            return DocumentParser._parse_text(file_path)
        else:
            raise ValueError(f"Unsupported file format: {ext}")

    @staticmethod
    def _parse_pdf(file_path: str) -> List[Dict[str, Any]]:
        results = []
        try:
            reader = pypdf.PdfReader(file_path)
            total_pages = len(reader.pages)
            for idx, page in enumerate(reader.pages):
                text = page.extract_text()
                if text and text.strip():
                    results.append({
                        "content": text.strip(),
                        "page_number": idx + 1,
                        "section": f"Page {idx + 1} of {total_pages}",
                        "metadata": {"total_pages": total_pages}
                    })
        except Exception as e:
            logger.error(f"Error reading PDF {file_path}: {e}")
            raise
        return results

    @staticmethod
    def _parse_docx(file_path: str) -> List[Dict[str, Any]]:
        results = []
        try:
            doc = docx.Document(file_path)
            current_section = "General"
            current_content = []
            
            for para in doc.paragraphs:
                text = para.text.strip()
                if not text:
                    continue
                
                # Check heading style
                if para.style.name.startswith("Heading"):
                    if current_content:
                        results.append({
                            "content": "\n".join(current_content),
                            "page_number": None,
                            "section": current_section,
                            "metadata": {}
                        })
                        current_content = []
                    current_section = text
                else:
                    current_content.append(text)
            
            if current_content:
                results.append({
                    "content": "\n".join(current_content),
                    "page_number": None,
                    "section": current_section,
                    "metadata": {}
                })
        except Exception as e:
            logger.error(f"Error reading DOCX {file_path}: {e}")
            raise
        return results

    @staticmethod
    def _parse_csv(file_path: str) -> List[Dict[str, Any]]:
        results = []
        try:
            df = pd.read_csv(file_path)
            # Break table into rows of formatted text
            chunk_size = 50  # 50 rows per batch
            for i in range(0, len(df), chunk_size):
                batch = df.iloc[i:i + chunk_size]
                text_table = batch.to_string(index=False)
                results.append({
                    "content": text_table,
                    "page_number": (i // chunk_size) + 1,
                    "section": f"Rows {i+1} to {min(i+chunk_size, len(df))}",
                    "metadata": {"row_count": len(df), "columns": list(df.columns)}
                })
        except Exception as e:
            logger.error(f"Error reading CSV {file_path}: {e}")
            raise
        return results

    @staticmethod
    def _parse_xlsx(file_path: str) -> List[Dict[str, Any]]:
        results = []
        try:
            excel = pd.ExcelFile(file_path)
            for sheet_name in excel.sheet_names:
                df = pd.read_excel(excel, sheet_name=sheet_name)
                chunk_size = 50
                for i in range(0, len(df), chunk_size):
                    batch = df.iloc[i:i + chunk_size]
                    text_table = batch.to_string(index=False)
                    results.append({
                        "content": f"Sheet: {sheet_name}\n" + text_table,
                        "page_number": (i // chunk_size) + 1,
                        "section": f"Sheet: {sheet_name} (Rows {i+1}-{min(i+chunk_size, len(df))})",
                        "metadata": {"sheet": sheet_name, "columns": list(df.columns)}
                    })
        except Exception as e:
            logger.error(f"Error reading Excel {file_path}: {e}")
            raise
        return results

    @staticmethod
    def _parse_text(file_path: str) -> List[Dict[str, Any]]:
        results = []
        try:
            with open(file_path, "r", encoding="utf-8", errors="replace") as f:
                content = f.read()
            
            # Simple section splitting on Markdown headings or full text
            lines = content.split("\n")
            current_section = "Document Body"
            current_lines = []
            
            for line in lines:
                if line.startswith("#"):
                    if current_lines:
                        results.append({
                            "content": "\n".join(current_lines).strip(),
                            "page_number": 1,
                            "section": current_section,
                            "metadata": {}
                        })
                        current_lines = []
                    current_section = line.strip("#").strip()
                else:
                    current_lines.append(line)
                    
            if current_lines:
                results.append({
                    "content": "\n".join(current_lines).strip(),
                    "page_number": 1,
                    "section": current_section,
                    "metadata": {}
                })
        except Exception as e:
            logger.error(f"Error reading text file {file_path}: {e}")
            raise
        return results

document_parser = DocumentParser()
