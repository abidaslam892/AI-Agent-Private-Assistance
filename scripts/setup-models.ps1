# ===================================================
# Ollama Model Setup Script for Private RAG Platform
# ===================================================

param (
    [string]$ChatModel = "llama3.1:8b",
    [string]$EmbedModel = "nomic-embed-text"
)

Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "Setting up AI Models in Ollama Container..." -ForegroundColor Cyan
Write-Host "Chat Model: $ChatModel" -ForegroundColor Yellow
Write-Host "Embedding Model: $EmbedModel" -ForegroundColor Yellow
Write-Host "=================================================" -ForegroundColor Cyan

# Wait for Ollama service to be ready
Write-Host "Checking Ollama connectivity..." -ForegroundColor Cyan
$maxRetries = 20
$retryCount = 0
$ollamaReady = $false

while (-not $ollamaReady -and $retryCount -lt $maxRetries) {
    try {
        $res = Invoke-RestMethod -Uri "http://localhost:11434/api/tags" -Method Get -TimeoutSec 3 -ErrorAction Stop
        $ollamaReady = $true
        Write-Host "Ollama service is up and responsive!" -ForegroundColor Green
    } catch {
        $retryCount++
        Write-Host "Waiting for Ollama to become available... (Attempt $retryCount/$maxRetries)" -ForegroundColor DarkGray
        Start-Sleep -Seconds 3
    }
}

if (-not $ollamaReady) {
    Write-Host "Error: Could not reach Ollama at http://localhost:11434. Make sure 'docker compose up -d' is running." -ForegroundColor Red
    exit 1
}

# Pull Embedding Model
Write-Host "`nPulling Embedding Model ($EmbedModel)..." -ForegroundColor Cyan
docker exec -it rag-ollama ollama pull $EmbedModel
if ($LASTEXITCODE -eq 0) {
    Write-Host "Successfully pulled $EmbedModel!" -ForegroundColor Green
} else {
    Write-Host "Warning: Failed to pull $EmbedModel via docker exec. Attempting HTTP API pull..." -ForegroundColor Yellow
    Invoke-RestMethod -Uri "http://localhost:11434/api/pull" -Method Post -Body (@{name=$EmbedModel} | ConvertTo-Json) -ContentType "application/json"
}

# Pull Chat Model
Write-Host "`nPulling Chat Model ($ChatModel)..." -ForegroundColor Cyan
docker exec -it rag-ollama ollama pull $ChatModel
if ($LASTEXITCODE -eq 0) {
    Write-Host "Successfully pulled $ChatModel!" -ForegroundColor Green
} else {
    Write-Host "Warning: Failed to pull $ChatModel via docker exec. Attempting HTTP API pull..." -ForegroundColor Yellow
    Invoke-RestMethod -Uri "http://localhost:11434/api/pull" -Method Post -Body (@{name=$ChatModel} | ConvertTo-Json) -ContentType "application/json"
}

Write-Host "`nVerifying Installed Models:" -ForegroundColor Cyan
docker exec -it rag-ollama ollama list
Write-Host "`nModel Setup Complete!" -ForegroundColor Green
