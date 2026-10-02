#!/usr/bin/env bash

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ ! -f "$ROOT/.env.r2" ]]; then
  echo "Error: .env.r2 not found."
  exit 1
fi

source "$ROOT/.env.r2"

if [[ $# -ne 2 ]]; then
  echo "Usage:"
  echo "  $0 SOURCE R2_PATH"
  echo
  echo "Example:"
  echo "  $0 ./reel-12-label.jpg documents/reel-12-label.jpg"
  exit 1
fi

INPUT="$1"
R2_PATH="$2"

if [[ ! -f "$INPUT" ]]; then
  echo "Error: source file does not exist:"
  echo "  $INPUT"
  exit 1
fi

if [[ "$R2_PATH" != documents/* ]]; then
  echo "Error: R2 document path must be under documents/"
  echo
  echo "Example:"
  echo "  documents/reel-12-label.jpg"
  exit 1
fi

echo "Checking R2 for existing object..."

if aws s3api head-object \
  --bucket "$R2_BUCKET" \
  --key "$R2_PATH" \
  --profile "$AWS_PROFILE" \
  --endpoint-url "$R2_ENDPOINT" \
  >/dev/null 2>&1; then

  echo
  echo "ERROR: R2 object already exists:"
  echo "  $R2_PATH"
  echo
  echo "Nothing was uploaded."
  exit 1
fi

echo "Uploading:"
echo "  $R2_PATH"
echo

aws s3 cp \
  "$INPUT" \
  "s3://${R2_BUCKET}/${R2_PATH}" \
  --profile "$AWS_PROFILE" \
  --endpoint-url "$R2_ENDPOINT"

echo
echo "Verifying upload..."

aws s3api head-object \
  --bucket "$R2_BUCKET" \
  --key "$R2_PATH" \
  --profile "$AWS_PROFILE" \
  --endpoint-url "$R2_ENDPOINT" \
  >/dev/null

echo
echo "✓ Upload successful"
echo
echo "R2 path:"
echo "  $R2_PATH"

if [[ -n "${R2_PUBLIC_URL:-}" ]]; then
  echo
  echo "Public URL:"
  echo "  ${R2_PUBLIC_URL%/}/${R2_PATH}"
fi
