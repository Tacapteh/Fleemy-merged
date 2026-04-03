#!/usr/bin/env bash
# Fleemy — Lancement en mode démo (sans Firebase)
# Usage : ./start.sh
# Prérequis : Node.js 18+

set -e

echo "🚀 Fleemy — Mode démo"
echo "---------------------"

cd "$(dirname "$0")/frontend"

if [ ! -d "node_modules" ]; then
  echo "📦 Installation des dépendances..."
  npm install
fi

echo ""
echo "✅ L'app s'ouvre sur : http://localhost:3000"
echo "   Mode démo activé — données fictives, pas besoin de Firebase"
echo ""

VITE_MOCK_MODE=true npx vite --port 3000
