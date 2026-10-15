# ==============================================================================
# Karachi Mart - Lightweight Local Development Server (PowerShell)
# Zero dependencies required. Serves HTML, CSS, JavaScript, and JSON with CORS.
# ==============================================================================

param(
    [int]$Port = 3000
)

$root = $PSScriptRoot
if (-not $root) { $root = (Get-Location).Path }

$mimeMap = @{
    ".html" = "text/html; charset=utf-8"
    ".htm"  = "text/html; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".mjs"  = "application/javascript; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".svg"  = "image/svg+xml"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".jpeg" = "image/jpeg"
    ".webp" = "image/webp"
    ".ico"  = "image/x-icon"
}

$listener = New-Object System.Net.HttpListener
$prefix = "http://localhost:$Port/"
$listener.Prefixes.Add($prefix)

try {
    $listener.Start()
} catch {
    $Port = 8080
    $prefix = "http://localhost:$Port/"
    $listener = New-Object System.Net.HttpListener
    $listener.Prefixes.Add($prefix)
    $listener.Start()
}

Write-Host ""
Write-Host "======================================================================" -ForegroundColor Green
Write-Host "  🛒 KARACHI MART - LOCAL DEV SERVER RUNNING" -ForegroundColor White
Write-Host "======================================================================" -ForegroundColor Green
Write-Host "  Local URL:    $prefix" -ForegroundColor Cyan
Write-Host "  Root Folder:  $root" -ForegroundColor Gray
Write-Host "  Press Ctrl+C in this terminal window to stop the server." -ForegroundColor Yellow
Write-Host "======================================================================" -ForegroundColor Green
Write-Host ""

try {
    while ($listener.IsListening) {
        try {
            $context = $listener.GetContext()
            $request = $context.Request
            $response = $context.Response

            # CORS Headers
            $response.Headers.Add("Access-Control-Allow-Origin", "*")
            $response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            $response.Headers.Add("Access-Control-Allow-Headers", "*")

            if ($request.HttpMethod -eq "OPTIONS") {
                $response.StatusCode = 200
                $response.Close()
                continue
            }

            $rawUrl = $request.Url.LocalPath
            if ($rawUrl -eq "/" -or [string]::IsNullOrWhiteSpace($rawUrl)) {
                $rawUrl = "/index.html"
            }

            # Clean relative path
            $relPath = $rawUrl.TrimStart("/").Replace("/", [System.IO.Path]::DirectorySeparatorChar)
            $filePath = [System.IO.Path]::Combine($root, $relPath)

            # SPA fallback: if file does not exist and doesn't have an extension, serve index.html
            if (-not (Test-Path $filePath -PathType Leaf)) {
                $filePath = [System.IO.Path]::Combine($root, "index.html")
            }

            if (Test-Path $filePath -PathType Leaf) {
                $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
                $mime = "application/octet-stream"
                if ($mimeMap.ContainsKey($ext)) {
                    $mime = $mimeMap[$ext]
                }

                $bytes = [System.IO.File]::ReadAllBytes($filePath)
                $response.ContentType = $mime
                $response.ContentLength64 = $bytes.Length
                $response.StatusCode = 200
                $response.OutputStream.Write($bytes, 0, $bytes.Length)
            } else {
                $response.StatusCode = 404
                $msg = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
                $response.OutputStream.Write($msg, 0, $msg.Length)
            }

            $response.Close()
        } catch {
            Write-Host "Error handling request: $_" -ForegroundColor Red
        }
    }
} finally {
    $listener.Stop()
    $listener.Close()
}
