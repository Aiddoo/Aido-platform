# EAS Secrets 설정 가이드

**Version**: 1.2.0 · **Last Updated**: 2026-11-02 · **Owner**: Aido Mobile Team

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

### 3. Google Service Info Plist (iOS)

환경마다 번들 ID가 달라(`com.aido.mobile` · `.preview` · `.dev`) Firebase iOS 앱과 plist도 환경별로 하나씩이다.
같은 이름 `GOOGLE_SERVICES_INFO_PLIST`를 EAS 환경마다 다른 값으로 등록하면 `app.config.ts`가 환경별 파일로 복원한다.

| APP_ENV     | 번들 ID                   | 로컬 파일                              |
| ----------- | ------------------------- | -------------------------------------- |
| production  | `com.aido.mobile`         | `GoogleService-Info.plist`             |
| preview     | `com.aido.mobile.preview` | `GoogleService-Info.preview.plist`     |
| development | `com.aido.mobile.dev`     | `GoogleService-Info.development.plist` |

```bash
base64 -i GoogleService-Info.development.plist | pbcopy
eas env:create --name GOOGLE_SERVICES_INFO_PLIST --value "붙여넣기" \
  --environment development --visibility secret
```

Android `google-services.json`은 패키지별 client가 한 파일에 함께 들어 있어 모든 환경이 같은 파일을 쓴다.
Firebase 콘솔에 `.dev`·`.preview` Android 앱을 추가한 뒤 다시 받은 파일을 등록한다.

> 운영(`com.aido.mobile`)과 개발 빌드는 번들 ID가 달라 한 기기에 함께 설치되고, 키체인·App Group·푸시 토큰도 분리된다.
> 개발 빌드가 운영 앱을 덮어써 운영 토큰을 개발 서버로 보내는 일이 없다.

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
