# Verification script
$client = New-Object System.Net.WebClient

Write-Host "--- Testing Karachi Mart Web Server ---" -ForegroundColor Cyan

$urls = @(
    "http://localhost:3000/",
    "http://localhost:3000/src/css/style.css",
    "http://localhost:3000/src/css/variables.css",
    "http://localhost:3000/src/css/base.css",
    "http://localhost:3000/src/css/components.css",
    "http://localhost:3000/src/css/layout.css",
    "http://localhost:3000/src/css/pages.css",
    "http://localhost:3000/src/js/app.js",
    "http://localhost:3000/src/js/router.js",
    "http://localhost:3000/src/js/config.js",
    "http://localhost:3000/src/js/data/seedProducts.js",
    "http://localhost:3000/src/js/services/dataService.js",
    "http://localhost:3000/src/js/services/cartService.js",
    "http://localhost:3000/src/js/services/toastService.js"
)

$allPassed = $true

foreach ($u in $urls) {
    try {
        $content = $client.DownloadString($u)
        $len = $content.Length
        Write-Host "OK [200] $u ($len bytes)" -ForegroundColor Green
    } catch {
        Write-Host "FAIL $u : $_" -ForegroundColor Red
        $allPassed = $false
    }
}

if ($allPassed) {
    Write-Host "`nAll 14 core website files successfully served!" -ForegroundColor Green
} else {
    Write-Host "`nSome files failed to serve." -ForegroundColor Red
}
