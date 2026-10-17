import os
import tempfile
import pytest
from app.services.document_parser import document_parser

def test_parse_text_file():
    with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False) as f:
        f.write("# Telecom BSS Architecture\n\nThe BSS platform handles charging, billing, and customer care.\nGMLC provides location determination.")
        temp_path = f.name

    try:
        sections = document_parser.parse_file(temp_path, "telecom_bss.txt")
        assert len(sections) > 0
        assert "Telecom BSS Architecture" in sections[0]["section"]
        assert "charging, billing" in sections[0]["content"]
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

def test_parse_csv_file():
    with tempfile.NamedTemporaryFile("w", suffix=".csv", delete=False) as f:
        f.write("service_name,tps,latency_ms,error_rate\nOCS,14500,24.5,0.01\nGMLC,4200,48.2,0.04\n")
        temp_path = f.name

    try:
        sections = document_parser.parse_file(temp_path, "metrics.csv")
        assert len(sections) > 0
        assert "OCS" in sections[0]["content"]
        assert "GMLC" in sections[0]["content"]
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)
