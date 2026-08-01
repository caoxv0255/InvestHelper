@echo off
set "PATH=C:\Users\CaoXv\AppData\Local\nvm\v22.22.3;C:\Users\CaoXv\AppData\Roaming\npm;C:\Windows\System32;C:\Windows"
cd /d "d:\Desktop\InvestHelper\frontend"
echo === CWD ===
cd
echo === NODE VERSION ===
node --version
echo === NPM VERSION ===
call npm --version
echo === NPM CONFIG GET PREFIX ===
call npm config get prefix
echo === NPM ROOT ===
call npm root
echo === INSTALLING ===
call npm install --no-audit --no-fund 2>&1
echo EXIT_CODE:%ERRORLEVEL%
echo === CHECK NODE_MODULES ===
dir node_modules /b 2>&1 | findstr /c:"lightweight" /c:"vite" /c:"react"
echo DONE
