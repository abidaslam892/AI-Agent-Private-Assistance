import re
from typing import List, Dict, Any
from app.core.config import settings

class RecursiveCharacterTextSplitter:
    def __init__(self, chunk_size: int = settings.CHUNK_SIZE, chunk_overlap: int = settings.CHUNK_OVERLAP):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.separators = ["\n\n", "\n", ". ", " ", ""]

    def split_text(self, text: str) -> List[str]:
        if len(text) <= self.chunk_size:
            return [text] if text.strip() else []

        splits = []
        start = 0
        text_len = len(text)

        while start < text_len:
            end = min(start + self.chunk_size, text_len)
            
            # If not at the end of the text, try to find a natural break point
            if end < text_len:
                best_break = -1
                for sep in self.separators:
                    pos = text.rfind(sep, start, end)
                    if pos != -1 and pos > start:
                        best_break = pos + len(sep)
                        break
                if best_break != -1:
                    end = best_break

            chunk = text[start:end].strip()
            if chunk:
                splits.append(chunk)

            # Move start pointer forward with overlap
            if end >= text_len:
                break
            start = max(start + 1, end - self.chunk_overlap)

        return splits

    def split_parsed_sections(self, parsed_sections: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        chunks = []
        chunk_idx = 0
        for sec in parsed_sections:
            content = sec.get("content", "")
            page_number = sec.get("page_number")
            section_title = sec.get("section")
            metadata = sec.get("metadata", {})

            text_chunks = self.split_text(content)
            for ch in text_chunks:
                # Estimate token count roughly as ~4 characters per token
                approx_tokens = max(1, len(ch) // 4)
                chunks.append({
                    "chunk_index": chunk_idx,
                    "content": ch,
                    "page_number": page_number,
                    "section": section_title,
                    "token_count": approx_tokens,
                    "metadata": metadata
                })
                chunk_idx += 1
        return chunks

text_splitter = RecursiveCharacterTextSplitter()
