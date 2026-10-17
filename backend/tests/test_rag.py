import pytest
from app.services.rag_engine import RAGEngine

def test_system_prompt_construction():
    context = "[Source 1: GMLC_Manual.pdf (Page 4)]\nBaseline TPS is 5000 with 45ms latency."
    prompt = RAGEngine.construct_system_prompt(context)
    
    assert "enterprise AI Knowledge Assistant" in prompt
    assert "GMLC_Manual.pdf" in prompt
    assert "Baseline TPS is 5000" in prompt
    assert "insufficient information" in prompt
