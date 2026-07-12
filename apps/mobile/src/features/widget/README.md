# widget — 홈 화면 위젯 (iOS WidgetKit + Android AppWidget)

> 상세 아키텍처 가이드: [`apps/mobile/.claude/widgets.md`](../../../.claude/widgets.md)

오늘 할 일 진행률(AidoProgress)과 오늘 할 일 목록(AidoTodayList)을 홈 화면에서 보여주는 feature.

## 핵심 원칙

**위젯은 앱이 기록한 스냅샷의 순수 렌더러다.** 위젯 프로세스(iOS 확장 / Android headless)는
네트워크·토큰·SecureStore에 일절 접근하지 않는다. 따라서 이 feature의 어떤 실패도
로그인 세션에 영향을 줄 수 없다(세션 불변식 — v1.4.0 사고 재발 방지).

## 데이터 흐름

```
GET v1/todos/summary (진행률+스트릭+상위 할 일, X-Timezone 기준 "오늘")
  → useWidgetSnapshotSync (AuthProvider에 마운트된 유일한 통합 지점)
  → WidgetSyncService.syncSummary
  → widget-snapshot.mapper (localized 문자열을 스냅샷에 굽기)
  → WidgetBridge (플랫폼 포트)
      ├─ iOS: expo-widgets updateTimeline([지금, 다음 자정=stale]) → App Group
      └─ Android: MMKV(widget-storage) 영속화 + requestWidgetUpdate({light, dark})

위젯 렌더 (읽기 전용):
  iOS: presentations/ios/aido-widgets.tsx ('widget' 디렉티브 → SwiftUI 컴파일)
  Android: task-handler → 스냅샷 읽기 → presentations/android FlexWidget 트리
```

갱신 트리거: 할 일 토글/생성/삭제(쿼리 키가 `completions()` 하위라 기존 invalidation 상속),
앱 포그라운드 복귀(focusManager), 자정 넘긴 복귀(useToday 키 회전), 언어 변경, 로그아웃.

## 구조 (SRP)

| 경로 | 책임 |
|------|------|
| `models/widget-snapshot.model.ts` | Zod 스냅샷 스키마 + 렌더 상태 정책 + 배지 티어 (단일 진실원) |
| `services/widget-snapshot.mapper.ts` | 요약 → 스냅샷 순수 변환 (t/locale/now 주입) |
| `services/widget-sync.service.ts` | 오케스트레이션 — **절대 throw하지 않음** (Sentry 관측만) |
| `services/widget-fallback.ts` | 첫 스냅샷 이전의 정적 2개 국어 폴백 |
| `repositories/` | Android 스냅샷 영속화 (MMKV `widget-storage` — Repository 패턴 예외) |
| `bridge/` | `WidgetBridge` 포트 + 플랫폼 어댑터 3종 (ios/android/noop) |
| `presentations/ios/` | 'widget' 디렉티브 레이아웃 — **모듈 스코프 참조 금지(자기완결)** |
| `presentations/android/` | FlexWidget 트리 (라이트/다크 × data/empty/loggedOut/stale) |
| `presentations/hooks/` | `useWidgetSnapshotSync` — 앱 트리 통합 지점 |
| `task-handler/` | Android headless 엔트리 (읽기+렌더만) + headless 관측 도구 |

## 주의사항

- iOS 레이아웃 함수는 빌드 타임에 소스 문자열로 추출된다 — 임포트한 **값**을 참조하면
  위젯 런타임에서 터진다. 팔레트는 `widget-colors.constant.ts`와 동일 값을 인라인 유지할 것.
- 위젯 이름(`AidoProgress`/`AidoTodayList`)은 `app.config.ts` 두 플러그인 설정과
  `createWidget()`/`ANDROID_WIDGET_NAMES`가 모두 일치해야 한다.
- 스냅샷 스키마 변경 시 `version` 리터럴을 올리고 read 쪽 safeParse가 폴백하게 둘 것.
- 색상은 global.css OKLCH 토큰의 hex 고정본 — 토큰 변경 시 함께 갱신.
