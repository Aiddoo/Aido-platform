# 홈 화면 위젯 가이드 (iOS WidgetKit + Android AppWidget)

**Version**: 1.0.0 · **Last Updated**: 2026-07-12 · **Owner**: Aido Mobile Team

v1.5.1에서 도입. 진행률 위젯(AidoProgress: small/medium, 2x2)과
오늘 할 일 리스트 위젯(AidoTodayList: medium/large, 4x2 세로 리사이즈)을 제공한다.

---

## 0. 세션/인증 절대 불변식 (최우선 — 위반 금지)

- 위젯 프로세스(iOS 확장 / Android headless task handler)는 **토큰·SecureStore·네트워크에
  일절 접근하지 않는다**. 앱이 기록한 스냅샷을 읽어 렌더만 한다.
- `expo-secure-store`의 키 이름·keychainService·accessGroup 등 영속성 계약을 위젯 때문에
  변경하지 않는다 (변경 = 기존 토큰 고아화 = 대량 로그아웃).
- `POST /v1/auth/refresh`는 앱 JS 런타임(기존 ky 훅)만 호출한다.
- 위젯 요약 쿼리는 AuthProvider(전 화면 상위)에서 돌므로 `throwOnError: false` 필수 —
  실패가 ErrorBoundary로 새면 콜드 스타트 fallback 화면이 재발한다.

## 1. 아키텍처

```
GET v1/todos/summary ─→ useWidgetSnapshotSync(AuthProvider) ─→ WidgetSyncService
                                                                    │ mapper (문자열 굽기)
                                              WidgetBridge 포트 ────┤
                          iOS: expo-widgets updateTimeline ←────────┼──→ Android: MMKV + requestWidgetUpdate
                          (App Group, 2엔트리: 지금/자정 stale)          (headless task handler가 재렌더)
```

- **스택**: iOS `expo-widgets`(공식, TS/JSX → SwiftUI 컴파일) · Android `react-native-android-widget`(RemoteViews)
- **스냅샷**: `features/widget/models/widget-snapshot.model.ts` — Zod 단일 진실원.
  localized 문자열은 쓰기 시점에 굽는다(iOS 타임라인 props는 직렬화되어 렌더 시 i18n 불가).
- **갱신 트리거**(전부 `useWidgetSnapshotSync` 하나로 수렴): 할 일 변경(쿼리 키가
  `TODO_QUERY_KEYS.completions()` 하위라 기존 invalidation 상속) · 포그라운드 복귀 ·
  자정 넘긴 복귀(useToday 키 회전) · 언어 변경 · 로그아웃.
- **자정 롤오버**: iOS는 타임라인 2번째 엔트리(다음 로컬 자정 = stale 상태)로 자동 전환,
  Android는 `updatePeriodMillis`(30분) 주기 갱신에서 `snapshot.date !== 오늘`이면 stale 렌더
  (최대 ~30분 스테일 수용).

## 2. 설정 지점

| 위치 | 내용 |
|------|------|
| `app.config.ts` | `expo-widgets` + `react-native-android-widget` 플러그인, App Group(`group.<bundleId>` — 환경별 자동 분리), 메인 앱 entitlements |
| `index.ts` | Android task handler 등록 (`Platform.OS === 'android'` 가드) |
| `di-provider.tsx` | repository → bridge → `WidgetSyncService` 조립, `useWidgetSyncService` 훅 |
| `auth-provider.tsx` | `useWidgetSnapshotSync(authState)` 마운트 (유일한 통합 지점) |

## 3. 새 위젯 추가 방법

1. `app.config.ts` 두 플러그인의 `widgets[]`에 이름 추가 (Swift 식별자 규칙, 양 플랫폼 동일 이름 권장)
2. iOS: `presentations/ios/`에 `'widget'` 디렉티브 레이아웃 작성 + `createWidget(name, layout)` export
   — **함수는 자기완결이어야 함**(모듈 스코프 값 참조 금지, 팔레트 인라인)
3. Android: `presentations/android/`에 FlexWidget 트리 + `ANDROID_WIDGET_NAMES`에 이름 추가
4. 브리지: iOS `expo-widgets.bridge.ts`에 `updateTimeline` 대상 추가 (Android는 이름 배열로 자동)
5. `pnpm native:prebuild`로 네이티브 재생성 → dev 빌드로 확인 (Expo Go 불가)

## 4. 디자인 규칙

- 팔레트: `presentations/constants/widget-colors.constant.ts` — global.css OKLCH 토큰의 hex 고정본.
  **토큰 변경 시 이 파일과 iOS 레이아웃의 인라인 팔레트를 함께 갱신할 것.**
- Linear 스타일: 뉴트럴 배경 + 타이포 위계, 브랜드 오렌지(#FF6B43)는 프로그레스 필·체크·스트릭에만.
- 위젯은 OS 시스템 테마 추종(앱 내 테마 오버라이드 미적용 — 플랫폼 표준).
- 폰트: Android는 플러그인 fonts로 WantedSans, iOS 확장은 시스템 폰트(SF).

## 5. 관측

- Sentry: `WidgetSyncService`가 실패를 `feature: 'widget'`으로 captureException,
  성공은 `widget` 카테고리 breadcrumb. task handler 실패도 동일 계약.
- Analytics: `widget_added`/`widget_removed` (Android 시스템 이벤트 기반 — iOS는
  WidgetKit이 콜백을 제공하지 않아 미집계, 알려진 한계).

## 6. 테스트

- 단위: 모델 정책/배지 티어, 매퍼(문자열 굽기·절단), repository(라운드트립·손상 JSON),
  sync service(무throw 계약) — `src/features/widget/**/*.test.ts`
- 렌더 트리(FlexWidget/SwiftUI)는 단위 테스트 불가 — 수동 QA 체크리스트:
  - [ ] 위젯 추가(픽커 라벨/설명) — 양 플랫폼, 전 사이즈
  - [ ] 할 일 토글 → 위젯 즉시 반영 (앱 백그라운드 전환 후 홈 화면 확인)
  - [ ] 라이트/다크 전환
  - [ ] 상태 4종: data / empty / loggedOut / stale(기기 날짜 변경)
  - [ ] 언어 변경(ko↔en) 반영
  - [ ] Android 세로 리사이즈(3→7행), iOS large(7행)
  - [ ] 로그아웃 → "로그인이 필요해요" / 재로그인 → 데이터 복원
  - [ ] 콜드 스타트에서 재시도 화면(fallback) 미재현

## 7. 알려진 한계 / 후속 과제

- 인위젯 체크오프(탭 완료) 미지원 — 탭하면 앱 열림. Android는 headless 경로 검증됨,
  iOS는 expo-widgets 인터랙션 API 성숙 후 재평가.
- iOS 마스코트는 SF Symbol(`pawprint.fill`) — 고양이 이미지 자산은 App Group 복사
  파이프라인(expo-asset/file-system) 도입 후.
- 위젯 픽커 라벨은 빌드 타임 정적 문자열(한국어 우선) — 양 플러그인의 다국어 미지원.
- 잠금화면 위젯(accessory family), 빠른 추가 위젯 — 후속 버전.
