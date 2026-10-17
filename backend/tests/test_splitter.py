import pytest
from app.services.text_splitter import RecursiveCharacterTextSplitter

def test_chunking_and_overlap():
    splitter = RecursiveCharacterTextSplitter(chunk_size=100, chunk_overlap=20)
    sample_text = (
        "Telecom BSS architecture consists of billing engines, OCS charging gateways, "
        "and mediation servers. The system processes thousands of transactions per second "
        "with sub-second latency thresholds."
    )
    chunks = splitter.split_text(sample_text)
    assert len(chunks) >= 2
    for c in chunks:
        assert len(c) <= 120  # bounded

def test_split_parsed_sections():
    splitter = RecursiveCharacterTextSplitter(chunk_size=80, chunk_overlap=15)
    parsed_sections = [
        {
            "content": "GMLC node operates at high availability. It routes MAP and Diameter requests efficiently.",
            "page_number": 1,
            "section": "Node Configuration",
            "metadata": {"source": "manual.pdf"}
        }
    ]
    chunks = splitter.split_parsed_sections(parsed_sections)
    assert len(chunks) >= 1
    assert chunks[0]["page_number"] == 1
    assert chunks[0]["section"] == "Node Configuration"
    assert chunks[0]["token_count"] > 0
