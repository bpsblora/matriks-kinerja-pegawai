#!/usr/bin/env bash
# One-time GitHub -> Firebase Hosting PREVIEW setup. No JSON private keys.
set -euo pipefail

PROJECT_ID="mkp-bps-blora"
REPO="bpsblora/matriks-kinerja-pegawai"
BRANCH="setup/firebase-foundation"
POOL_ID="matriks-github-preview"
PROVIDER_ID="repo-branch"
SERVICE_ACCOUNT_ID="matriks-gh-preview"
SERVICE_ACCOUNT_EMAIL="${SERVICE_ACCOUNT_ID}@${PROJECT_ID}.iam.gserviceaccount.com"

echo "Menyiapkan koneksi GitHub -> Firebase Hosting PREVIEW."
echo "Proyek: ${PROJECT_ID}; repo: ${REPO}; cabang: ${BRANCH}"
echo "Akun layanan: ${SERVICE_ACCOUNT_EMAIL} (HANYA Hosting + API Keys Viewer)."
echo "Akun ini tidak mendapatkan akses Firestore/Functions. Tidak ada JSON key."
echo "Script akan membuat Workload Identity Federation dan mengatur variabel GitHub."
read -r -p "Ketik LANJUT untuk menyetujui setup di atas: " answer
if [[ "$answer" != "LANJUT" ]]; then echo "Dibatalkan."; exit 1; fi

for cmd in gcloud gh; do
  command -v "$cmd" >/dev/null || { echo "Program $cmd tidak ditemukan."; exit 1; }
done
gh auth status >/dev/null
ACTIVE_PROJECT="$(gcloud config get-value project)"
if [[ "$ACTIVE_PROJECT" != "$PROJECT_ID" ]]; then
  echo "Proyek gcloud adalah $ACTIVE_PROJECT; diharapkan $PROJECT_ID."
  exit 1
fi

PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
test -n "$PROJECT_NUMBER"
echo "Mengaktifkan IAM Credentials dan STS untuk koneksi tanpa kunci…"
gcloud services enable iam.googleapis.com iamcredentials.googleapis.com sts.googleapis.com --project="$PROJECT_ID" --quiet

if ! gcloud iam workload-identity-pools describe "$POOL_ID" --location=global --project="$PROJECT_ID" >/dev/null 2>&1; then
  gcloud iam workload-identity-pools create "$POOL_ID" --project="$PROJECT_ID" --location=global --display-name="Matriks GitHub Hosting preview" --quiet
fi

if ! gcloud iam workload-identity-pools providers describe "$PROVIDER_ID" --workload-identity-pool="$POOL_ID" --location=global --project="$PROJECT_ID" >/dev/null 2>&1; then
  gcloud iam workload-identity-pools providers create-oidc "$PROVIDER_ID" \
    --project="$PROJECT_ID" --location=global --workload-identity-pool="$POOL_ID" \
    --display-name="GitHub repo preview branch" \
    --issuer-uri="https://token.actions.githubusercontent.com" \
    --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref" \
    --attribute-condition="assertion.repository=='${REPO}' && assertion.ref=='refs/heads/${BRANCH}'" \
    --quiet
fi

if ! gcloud iam service-accounts describe "$SERVICE_ACCOUNT_EMAIL" --project="$PROJECT_ID" >/dev/null 2>&1; then
  gcloud iam service-accounts create "$SERVICE_ACCOUNT_ID" --project="$PROJECT_ID" \
    --display-name="GitHub Matriks preview deploy only" --quiet
fi

echo "Memberi izin minimum untuk deploy Firebase Hosting preview…"
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
  --role="roles/firebasehosting.admin" --quiet >/dev/null
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
  --role="roles/serviceusage.apiKeysViewer" --quiet >/dev/null

gcloud iam service-accounts add-iam-policy-binding "$SERVICE_ACCOUNT_EMAIL" \
  --project="$PROJECT_ID" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_ID}/attribute.repository/${REPO}" \
  --role="roles/iam.workloadIdentityUser" --quiet >/dev/null

PROVIDER_RESOURCE="projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_ID}/providers/${PROVIDER_ID}"
echo "Menyimpan nama koneksi di variabel repo GitHub (bukan password)…"
gh variable set GCP_WORKLOAD_IDENTITY_PROVIDER --repo "$REPO" --body "$PROVIDER_RESOURCE"
gh variable set GCP_DEPLOY_SERVICE_ACCOUNT --repo "$REPO" --body "$SERVICE_ACCOUNT_EMAIL"

echo
echo "KONFIGURASI BERHASIL. Tidak ada token / private key yang dibuat."
echo "Sekarang perubahan pada cabang ${BRANCH} dapat memicu preview deploy."
echo "Cek GitHub Actions untuk validasi hasil deploy."
