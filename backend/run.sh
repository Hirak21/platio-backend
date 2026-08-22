#!/usr/bin/env bash
# Run Platio locally. Installs deps into ./libs if missing, then starts uvicorn.
set -e
cd "$(dirname "$0")"
if [ ! -d libs ] || [ -z "$(ls -A libs 2>/dev/null)" ]; then
  echo "Installing dependencies into ./libs ..."
  python3 -m pip install --target=libs -r requirements.txt httpx pytest
fi
echo "Starting server at http://localhost:8000"
echo "Login: admin / platio1234"
PYTHONPATH=libs exec python3 -m uvicorn app:app --port 8000 --reload
