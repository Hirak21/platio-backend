#!/usr/bin/env bash
# Update frontend API_BASE and redeploy to Firebase
# Usage: ./update-frontend.sh <backend-url>

set -euo pipefail

BACKEND_URL="${1:-}"

if [[ -z "$BACKEND_URL" ]]; then
    echo "Usage: $0 <backend-url>"
    echo "Example: $0 https://platio-backend-abc123.onrender.com"
    exit 1
fi

# Remove trailing slash
BACKEND_URL="${BACKEND_URL%/}"

echo "Updating frontend API_BASE to: $BACKEND_URL"

# Update app.js
sed -i "s|const API_BASE = \".*\";|const API_BASE = \"$BACKEND_URL\";|" frontend/js/app.js

# Verify the change
grep "const API_BASE" frontend/js/app.js

# Redeploy to Firebase
echo "Redeploying to Firebase Hosting..."
firebase deploy --only hosting --project=platio-app

echo "Done! Frontend now points to: $BACKEND_URL"