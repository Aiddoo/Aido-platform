# @aido/mobile

메모가 할 일이 되고, 친구와 함께 끝내는 투두. Expo SDK 58 기반 React Native
모바일 앱입니다.

## 목차

- [기술 스택](#기술-스택)
- [개발 환경](#개발-환경)
- [실제 기기 테스트](#실제-기기-테스트)
- [빌드](#빌드)
- [스크립트](#스크립트)
- [환경별 API URL](#환경별-api-url)
- [배포](#배포)

## 기술 스택

| 분류       | 기술                           |
| ---------- | ------------------------------ |
| Framework  | Expo SDK 58, React Native 0.88 |
| Routing    | Expo Router                    |
| State      | TanStack Query v5              |
| HTTP       | Ky                             |
| Validation | Zod 4.6                        |
| UI         | HeroUI Native, Uniwind         |

## 개발 환경

```bash
pnpm dev          # Metro 번들러
pnpm dev:android  # Android
pnpm dev:ios      # iOS
```

## 실제 기기 테스트

앱이 Expo Metro 번들러 IP를 자동 감지합니다.

```bash
pnpm dev:android  # QR 코드 스캔
```

**조건**: 기기와 개발 머신이 같은 Wi-Fi에 연결

## 빌드

### 개발 빌드 (Dev Client)

```bash
pnpm build:development           # 전체
pnpm build:development:android   # Android
pnpm build:development:ios       # iOS
```

### 프리뷰 빌드 (내부 테스트)

```bash
pnpm build:preview
```

### 프로덕션 빌드

```bash
pnpm build:production            # 빌드
pnpm submit:production           # 스토어 제출
```

### OTA 업데이트

```bash
pnpm update:preview "메시지"
pnpm update:production "메시지"
```

## 스크립트

명령 전체는 `package.json`의 `scripts`가 원본입니다. 앱의 `pnpm check`는 lint·format·`lint:deps`만 돌고, 커밋 전 전체 검사는 루트 `pnpm check`입니다([루트 AGENTS](../../AGENTS.md#명령)).

## 환경별 API URL

| 환경               | Platform | API URL 변환               |
| ------------------ | -------- | -------------------------- |
| Android 에뮬레이터 | android  | localhost → 10.0.2.2       |
| iOS 시뮬레이터     | ios      | localhost 유지             |
| 실제 기기          | 둘 다    | localhost → {개발 머신 IP} |

## 배포

자세한 내용은 [build-and-release.md](./docs/build-and-release.md) 참고.

스토어 문구·스크린샷 순서·릴리스 체크리스트의 단일 준비본은 버전마다
`store-metadata/{버전}/release.json`을 참고합니다(앱 버전은 `package.json`이 정본). 이 파일을 변경해도 외부 스토어에 자동 게시되지는 않습니다.
한·영 스토어 등록 정보(이름·부제·설명·키워드·업데이트 내용)는
[`store-metadata/listing/`](./store-metadata/listing/README.md)에 있고 `pnpm store:check`로 검사합니다.
