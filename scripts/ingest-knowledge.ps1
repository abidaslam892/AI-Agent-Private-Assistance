# Uploads every file in .\knowledge to the platform so the assistant can retrieve it.
# Credentials come from parameters or the RAG_USER / RAG_PASSWORD environment variables.
param(
  [string]$Api = "http://localhost:8000/api/v1",
  [string]$User = $env:RAG_USER,
  [string]$Password = $env:RAG_PASSWORD
)
if (-not $User -or -not $Password) { throw "Provide -User/-Password or set RAG_USER and RAG_PASSWORD" }
$login = curl.exe -s -X POST "$Api/auth/login" -d "username=$User" --data-urlencode "password=$Password" | ConvertFrom-Json
$token = $login.access_token
if (-not $token) { throw "Login failed" }
Get-ChildItem "$PSScriptRoot\..\knowledge" -File | ForEach-Object {
  Write-Host "Uploading $($_.Name)"
  curl.exe -s -X POST "$Api/documents/upload" -H "Authorization: Bearer $token" -F "file=@$($_.FullName)" | Out-Null
}
Write-Host "Done. Indexing runs in background; check the Knowledge page."
