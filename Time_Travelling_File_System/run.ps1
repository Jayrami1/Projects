# run.ps1  – For Windows PowerShell
Write-Host "Compiling Time-Travelling File System..."
g++ -std=c++17 -Wall -O2 *.cpp -o main.exe
if ($LASTEXITCODE -ne 0) {
    Write-Host "Compilation failed. Please check for errors."
    exit 1
}
Write-Host "Compilation successful."
$choice = Read-Host "Run with input.txt? (y/n)"
if ($choice -match '^[Yy]$') {
    Write-Host "Running with input.txt..."
    Get-Content input.txt | .\main.exe
} else {
    Write-Host "Running interactively."
    .\main.exe
}