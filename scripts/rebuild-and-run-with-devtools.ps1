# Rebuild with electron-forge and run the built exe with DevTools enabled.
Write-Host "Setting ELECTRON_DEVTOOLS=1 for this PowerShell session..."
$env:ELECTRON_DEVTOOLS = '1'

Write-Host "Running: npm run make"
npm run make

Write-Host "Searching for built exe under the 'out' directory..."
$exe = Get-ChildItem -Path .\out -Recurse -Filter *.exe -File -ErrorAction SilentlyContinue |
       Where-Object { $_.Name -ne 'Setup.exe' } | Select-Object -First 1

if ($exe) {
    Write-Host "Found: $($exe.FullName) - launching..."
    Start-Process -FilePath $exe.FullName
} else {
    Write-Host "No runnable exe found under out. Opening the out folder for inspection..."
    if (Test-Path .\out) { Start-Process -FilePath (Resolve-Path .\out).Path } else { Write-Host "No out folder present." }
}
