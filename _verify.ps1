Write-Host "=== Backend import check ==="
Push-Location backend
python -c "from app.main import app; print('OK routes:', len(app.routes))"
Pop-Location
Write-Host "=== Frontend tsc check ==="
Push-Location frontend
npx tsc --noEmit
Write-Host "tsc exit: $LASTEXITCODE"
Pop-Location
