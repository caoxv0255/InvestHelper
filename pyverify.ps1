Set-Location backend
python -m py_compile app/services/sentiment.py
python -m py_compile app/api/sentiment.py
python -m py_compile app/main.py
python -c "from app.services import sentiment; from app.api import sentiment; from app.main import app; print('IMPORTS_OK')"
