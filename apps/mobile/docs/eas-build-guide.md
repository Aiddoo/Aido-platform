# EAS Build & Submit 가이드

> EAS 무료 티어 사용량 관리 및 배포 방법 정리

## 무료 티어 제한

| 서비스 | 무료 티어 한도 | 비고 |
|--------|---------------|------|
| EAS Build | **월 30분** (iOS/Android 각각) | 클라우드 빌드 시간 기준 |
| EAS Submit | **무제한** | 스토어 업로드만 수행 |
| EAS Update | **무제한** | OTA 업데이트 |

---

## 빌드 방법 비교

### 1. 클라우드 빌드 (EAS 서버)

```bash
eas build --platform ios --profile <profile>
eas build --platform android --profile <profile>
```

| 항목 | 내용 |
|-----|------|
| 무료 티어 차감 | ✅ **차감됨** |
| 예상 소요 시간 | iOS: 10-20분 / Android: 5-15분 |
| 장점 | 로컬 환경 설정 불필요 |
| 단점 | 무료 한도 제한, 대기열 존재 |

### 2. 로컬 빌드 (내 Mac)

```bash
eas build --platform ios --profile <profile> --local
eas build --platform android --profile <profile> --local
```

| 항목 | 내용 |
|-----|------|
| 무료 티어 차감 | ❌ **차감 안됨** |
| 요구사항 | Xcode, Fastlane, CocoaPods (iOS) / Android SDK (Android) |
| 장점 | 무제한 무료, 대기열 없음 |
| 단점 | 로컬 환경 설정 필요, Mac에서만 iOS 빌드 가능 |

#### 로컬 빌드 필수 도구 (iOS)

```bash
# 설치 확인
xcode-select -p          # Xcode
fastlane --version       # Fastlane
pod --version            # CocoaPods

# 미설치 시
brew install fastlane
brew install cocoapods
```

---

## 스토어 제출 방법 비교

### 1. EAS Submit

```bash
eas submit --platform ios --path ./build-xxxxx.ipa
eas submit --platform android --path ./build-xxxxx.aab
```

| 항목 | 내용 |
|-----|------|
| 무료 티어 차감 | ❌ **차감 안됨** |
| 장점 | CLI에서 바로 실행, 자동화 용이 |
| 비고 | Build 시간과 별개의 서비스 |

### 2. Apple Transporter (iOS 전용)

| 항목 | 내용 |
|-----|------|
| 무료 티어 차감 | ❌ **차감 안됨** (Apple 공식 앱) |
| 설치 | Mac App Store에서 "Transporter" 검색 |
| 사용법 | .ipa 파일 드래그 앤 드롭 → 전송 |

```bash
# CLI로 Transporter 설치
mas install 1450874784
```

### 3. Google Play Console 직접 업로드 (Android 전용)

| 항목 | 내용 |
|-----|------|
| 무료 티어 차감 | ❌ **차감 안됨** |
| 사용법 | [Play Console](https://play.google.com/console) → 앱 선택 → 프로덕션 → .aab 업로드 |

---

## 빌드 프로필 (eas.json)

| Profile | APP_ENV | 용도 | iOS 특징 | Android 특징 |
|---------|---------|-----|---------|-------------|
| `development` | development | 개발/디버깅 | 시뮬레이터용 | APK |
| `preview` | preview | 내부 테스트 | 실기기용 (Ad Hoc) | APK |
| `production` | production | 스토어 배포 | App Store용 | AAB |

```bash
# 프로필 지정
eas build --platform ios --profile development --local
eas build --platform ios --profile production --local
```

> `--profile` 미지정 시 기본값: **production**

---

## 권장 워크플로우

### 개발 중 (무료 티어 절약)

```bash
# 로컬 빌드 (무료)
eas build --platform ios --profile development --local

# 시뮬레이터에 설치
xcrun simctl install booted ./build-xxxxx.ipa
```

### TestFlight 배포

```bash
# 1. 로컬 빌드 (무료)
eas build --platform ios --profile production --local

# 2. TestFlight 업로드 (무료) - 택 1
eas submit --platform ios --path ./build-xxxxx.ipa  # EAS Submit
# 또는
# Transporter 앱에서 .ipa 드래그 앤 드롭
```

### 스토어 출시

```bash
# 1. 프로덕션 빌드
eas build --platform ios --profile production --local
eas build --platform android --profile production --local

# 2. 스토어 제출
eas submit --platform ios --path ./build-xxxxx.ipa
eas submit --platform android --path ./build-xxxxx.aab
```

---

## 요약: 비용 차감 여부

| 작업 | 명령어 | 차감 |
|-----|-------|-----|
| 클라우드 빌드 | `eas build` | ✅ 차감 |
| 로컬 빌드 | `eas build --local` | ❌ 무료 |
| EAS Submit | `eas submit` | ❌ 무료 |
| Transporter | GUI 앱 | ❌ 무료 |
| Play Console 업로드 | 웹 업로드 | ❌ 무료 |
| EAS Update (OTA) | `eas update` | ❌ 무료 |

---

## 참고 링크

- [EAS Build 문서](https://docs.expo.dev/build/introduction/)
- [EAS Submit 문서](https://docs.expo.dev/submit/introduction/)
- [로컬 빌드 문서](https://docs.expo.dev/build-reference/local-builds/)
- [Expo Pricing](https://expo.dev/pricing)
