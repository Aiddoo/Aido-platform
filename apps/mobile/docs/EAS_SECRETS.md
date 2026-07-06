# EAS Secrets 설정 가이드

**Version**: 1.1.0 · **Last Updated**: 2026-07-06 · **Owner**: Aido Mobile Team

EAS Build에서 민감한 파일들을 환경변수로 관리하는 방법입니다.

## 환경변수 설정

### 1. Google Services JSON (Android) 인코딩

```bash
# apps/mobile 디렉토리에서
base64 -i google-services.json | pbcopy
```

### 2. EAS Secret에 저장

```bash
# 모든 환경에서 사용 (권장)
eas secret:create --scope project --name GOOGLE_SERVICES_JSON --value "붙여넣기" --type string

# 또는 환경별로 설정 (고급)
# eas secret:create --scope project --name GOOGLE_SERVICES_JSON --value "붙여넣기" --type string --environment development
# eas secret:create --scope project --name GOOGLE_SERVICES_JSON --value "붙여넣기" --type string --environment preview
# eas secret:create --scope project --name GOOGLE_SERVICES_JSON --value "붙여넣기" --type string --environment production
```

### 3. Google Service Info Plist (iOS) - 선택사항

iOS용 Firebase 설정 파일도 같은 방식으로:

```bash
# 인코딩
base64 -i GoogleService-Info.plist | pbcopy

# EAS Secret에 저장
eas secret:create --scope project --name GOOGLE_SERVICES_INFO_PLIST --value "붙여넣기" --type string
```

### 4. Sentry (관측)

Sentry는 두 종류의 키를 쓴다 — 노출 성격이 다르므로 등록 방식도 다르다.

```bash
# (a) DSN — publishable(클라이언트 노출 OK). eas env로 런타임 주입.
eas env:create --name EXPO_PUBLIC_SENTRY_DSN --value "https://...@oXXX.ingest.sentry.io/XXX" \
  --environment production --visibility plaintext

# (b) Auth Token — 빌드 시 소스맵 업로드용. 절대 노출 금지 → sensitive.
eas env:create --name SENTRY_AUTH_TOKEN --value "sntrys_..." \
  --environment production --visibility sensitive
```

> - `EXPO_PUBLIC_SENTRY_DSN`은 `app.config.ts`의 `extra.sentryDsn`으로 전달되어 `initSentry()`에서 사용.
> - `SENTRY_AUTH_TOKEN`은 Sentry Expo 플러그인이 빌드 중 소스맵을 업로드할 때만 사용(런타임 미포함).
> - dev에서 로컬 테스트 시에만 `EXPO_PUBLIC_SENTRY_DEBUG=true`로 활성화(평소 dev는 리포팅 off).

## 설정 확인

```bash
# 저장된 secret 목록 확인
eas secret:list

# 특정 secret 삭제 (필요시)
eas secret:delete --name GOOGLE_SERVICES_JSON
```

## 작동 원리

1. `eas-build-pre-install.sh` 스크립트가 빌드 전에 자동 실행됩니다
2. 환경변수 `GOOGLE_SERVICES_JSON`을 Base64 디코딩합니다
3. `google-services.json` 파일로 복원합니다
4. `app.config.ts`의 `googleServicesFile` 설정이 해당 파일을 참조합니다

## 빌드 실행

이제 정상적으로 빌드됩니다:

```bash
# Development 빌드
eas build --profile development --platform android

# Preview 빌드
eas build --profile preview --platform android

# Production 빌드
eas build --profile production --platform android
```

## 주의사항

- **Base64 인코딩 시 줄바꿈 제거**: macOS의 경우 `base64 -i` 사용
- **Git에 커밋하지 않기**: `.gitignore`에 이미 설정되어 있음
- **Secret은 프로젝트 멤버만 접근 가능**: EAS 계정 권한 관리 필요
