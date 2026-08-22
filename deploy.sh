#!/usr/bin/env bash
# Deploy Platio to Firebase (Hosting + Functions 2nd Gen)
# Usage: ./deploy.sh [staging|production] [project-id]

set -euo pipefail

ENV="${1:-staging}"
PROJECT_ID="${2:-}"

if [[ -z "$PROJECT_ID" ]]; then
    echo "Usage: $0 [staging|production] <project-id>"
    echo "Example: $0 staging my-firebase-project"
    exit 1
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() { echo -e "${GREEN}[INFO]${NC} $*"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }

# Check required tools
for cmd in gcloud firebase docker; do
    if ! command -v "$cmd" &> /dev/null; then
        log_error "$cmd is not installed. Please install it first."
        exit 1
    fi
done

# Set variables
REGION="us-central1"
SERVICE_NAME="platio-api"
REPO_NAME="platio"
IMAGE_NAME="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/${SERVICE_NAME}"

# Check if Artifact Registry repo exists
log_info "Checking Artifact Registry repository..."
if ! gcloud artifacts repositories describe "${REPO_NAME}" --location="${REGION}" --project="${PROJECT_ID}" &>/dev/null; then
    log_warn "Artifact Registry repo '${REPO_NAME}' doesn't exist. Creating..."
    gcloud artifacts repositories create "${REPO_NAME}" \
        --repository-format=docker \
        --location="${REGION}" \
        --project="${PROJECT_ID}" \
        --description="Platio Docker images"
fi

# Build and push Docker image
log_info "Building Docker image..."
docker build -t "${IMAGE_NAME}:latest" -t "${IMAGE_NAME}:$(date +%Y%m%d-%H%M%S)" backend

log_info "Pushing to Artifact Registry..."
docker push "${IMAGE_NAME}:latest"

# Deploy to Firebase Functions (2nd gen) - this manages Cloud Run
log_info "Deploying to Firebase Functions (2nd gen)..."
cd functions
firebase deploy --only functions --project="${PROJECT_ID}"
cd ..

# Get the Cloud Run service URL (managed by Firebase Functions)
# Note: Firebase Functions 2nd gen gives a URL like https://REGION-PROJECT.cloudfunctions.net/FUNCTION_NAME
SERVICE_URL="https://${REGION}-${PROJECT_ID}.cloudfunctions.net/${SERVICE_NAME}"
log_info "Backend deployed at: ${SERVICE_URL}"

# Update frontend config with backend URL
log_info "Updating frontend with backend URL..."
sed -i "s|const API_BASE =.*|const API_BASE = '${SERVICE_URL}';|" frontend/js/app.js

# Deploy frontend to Firebase Hosting
log_info "Deploying frontend to Firebase Hosting..."
firebase deploy --only hosting --project="${PROJECT_ID}"

log_info "Deployment complete!"
echo ""
echo "Backend: ${SERVICE_URL}"
echo "Frontend: https://${PROJECT_ID}.web.app"
echo ""
echo "======================================================="
echo "IMPORTANT: You MUST set these secrets before it works:"
echo "======================================================="
echo "1. PLATIO_SECRET (JWT signing key):"
echo "   echo -n 'your-secure-64-char-random-string' | gcloud secrets create platio-secret --data-file=- --project=${PROJECT_ID}"
echo ""
echo "2. PLATIO_CORS_ORIGINS (for CORS):"
echo "   echo -n 'https://${PROJECT_ID}.web.app,https://${PROJECT_ID}.firebaseapp.com' | gcloud secrets create platio-cors-origins --data-file=- --project=${PROJECT_ID}"
echo ""
echo "Then redeploy functions: firebase deploy --only functions --project=${PROJECT_ID}"
echo ""
echo "Also: The first deploy will fail without secrets. Set them first, then deploy again."