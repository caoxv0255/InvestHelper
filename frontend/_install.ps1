$env:PATH = [System.Environment]::GetEnvironmentVariable('PATH', 'Machine') + ';' + [System.Environment]::GetEnvironmentVariable('PATH', 'User')
npm install lightweight-charts --no-audit --no-fund 2>&1
Write-Host "EXIT_CODE:$LASTEXITCODE"
