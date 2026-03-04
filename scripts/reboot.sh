#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "🚀 Starting Full Environment Reset..."

echo "--------------------------------------------------"
echo "[1/3] Running Git Reset..."
bash "$SCRIPT_DIR/git-reset.sh"
echo "✅ Git Reset Complete"

echo "--------------------------------------------------"
echo "[2/3] Running General Reset..."
bash "$SCRIPT_DIR/reset.sh"
echo "✅ General Reset Complete"

echo "--------------------------------------------------"
echo "[3/3] Running Initialization..."
bash "$SCRIPT_DIR/init.sh"
echo "✅ Initialization Complete"

echo "--------------------------------------------------"
echo "🎉 Environment is clean and ready for testing!"
