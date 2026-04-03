@echo off
REM Fleemy — Lancement en mode démo (sans Firebase)
REM Usage : double-clic sur start.bat
REM Prérequis : Node.js 18+

echo 🚀 Fleemy — Mode démo
echo ---------------------

cd /d "%~dp0frontend"

if not exist "node_modules" (
    echo 📦 Installation des dépendances...
    npm install
)

echo.
echo ✅ L'app s'ouvre sur : http://localhost:3000
echo    Mode démo activé — données fictives, pas besoin de Firebase
echo.

set VITE_MOCK_MODE=true
npx vite --port 3000
