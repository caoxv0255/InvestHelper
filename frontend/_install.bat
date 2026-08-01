@echo off
set "PATH=C:\Users\CaoXv\AppData\Local\nvm\v22.22.3;C:\Users\CaoXv\AppData\Roaming\npm;C:\Windows\System32;C:\Windows"
cd /d "d:\Desktop\InvestHelper\frontend"
call npm install --no-audit --no-fund
echo EXIT_CODE:%ERRORLEVEL%
