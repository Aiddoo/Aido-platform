#!/usr/bin/env bash

# =============================================================================
# EAS Build Pre-Install Hook
# 빌드 전에 환경변수에서 민감한 파일들을 복원합니다.
# =============================================================================

set -e

echo "🔧 Restoring sensitive files from environment variables..."

# Load .env when available so local runs match EAS env behavior
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"
if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
fi

# Google Services JSON (Android)
if [ -n "$GOOGLE_SERVICES_JSON" ]; then
  echo "📱 Restoring google-services.json..."
  mkdir -p android/app
  echo "$GOOGLE_SERVICES_JSON" | base64 -d > android/app/google-services.json
  echo "✅ google-services.json restored to android/app/"
  ls -lh android/app/google-services.json
else
  echo "⚠️  GOOGLE_SERVICES_JSON not found in environment variables"
  echo "⚠️  Build may fail if Firebase is required"
fi

# Google Services Info Plist (iOS)
if [ -n "$GOOGLE_SERVICES_INFO_PLIST" ]; then
  echo "🍎 Restoring GoogleService-Info.plist..."
  mkdir -p ios
  echo "$GOOGLE_SERVICES_INFO_PLIST" | base64 -d > ios/GoogleService-Info.plist
  echo "✅ GoogleService-Info.plist restored to ios/"
  ls -lh ios/GoogleService-Info.plist
else
  echo "⚠️  GOOGLE_SERVICES_INFO_PLIST not found in environment variables"
fi

echo "✅ Pre-install hook completed"
