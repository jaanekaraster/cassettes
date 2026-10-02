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
  echo "  $0 SOURCE.wav R2_PATH"
  echo
  echo "Example:"
  echo "  $0 ./3_s2_myrec.wav audio/3_s2_myrec.mp3"
  exit 1
fi

INPUT="$1"
R2_PATH="$2"

if [[ ! -f "$INPUT" ]]; then
  echo "Error: source file does not exist:"
  echo "  $INPUT"
  exit 1
fi

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "Error: ffmpeg is not installed."
  echo "Install it with:"
  echo "  sudo apt install ffmpeg"
  exit 1
fi

if [[ "$R2_PATH" != audio/*.mp3 ]]; then
  echo "Error: R2 audio path must be under audio/ and end in .mp3"
  echo
  echo "Example:"
  echo "  audio/3_s2_myrec.mp3"
  exit 1
fi

TMP_DIR="$(mktemp -d)"
OUTPUT="$TMP_DIR/output.mp3"

cleanup() {
  rm -rf "$TMP_DIR"
}

trap cleanup EXIT

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
  echo "Choose a different path or deliberately remove the existing object."
  exit 1
fi

echo "Converting WAV to MP3..."

ffmpeg \
  -hide_banner \
  -loglevel error \
  -i "$INPUT" \
  -codec:a libmp3lame \
  -q:a 2 \
  "$OUTPUT"

echo "Conversion complete."

echo
echo "Uploading:"
echo "  $R2_PATH"
echo

aws s3 cp \
  "$OUTPUT" \
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
echo
echo "Public URL:"
echo "  ${R2_PUBLIC_URL%/}/${R2_PATH}"
