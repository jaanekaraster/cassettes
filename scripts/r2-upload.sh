#!/usr/bin/env bash

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ ! -f "$ROOT/.env.r2" ]]; then
  echo "Error: .env.r2 not found."
  echo "Create it from the repository root first."
  exit 1
fi

source "$ROOT/.env.r2"

if [[ $# -ne 2 ]]; then
  echo "Usage:"
  echo "  $0 LOCAL_FILE R2_PATH"
  echo
  echo "Example:"
  echo "  $0 ./rec-001.mp3 audio/rec-001.mp3"
  exit 1
fi

LOCAL_FILE="$1"
R2_PATH="$2"

if [[ ! -f "$LOCAL_FILE" ]]; then
  echo "Error: local file does not exist:"
  echo "  $LOCAL_FILE"
  exit 1
fi

aws s3 cp \
  "$LOCAL_FILE" \
  "s3://${R2_BUCKET}/${R2_PATH}" \
  --profile "$AWS_PROFILE" \
  --endpoint-url "$R2_ENDPOINT"

echo
echo "Uploaded:"
echo "  $LOCAL_FILE"
echo
echo "R2 object:"
echo "  ${R2_PATH}"
