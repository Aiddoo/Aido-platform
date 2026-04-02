# 알림 설정 화면 리스트 → 상세 리팩토링

> GitHub Issue: #496
> Branch: `refactor/notification-settings-tab-structure`

## 배경

현재 알림 설정 화면(`settings/notifications.tsx`)이 단일 스크롤 뷰에 푸시 알림, 날씨 알림, 리마인드 알림 설정이 모두 나열되어 있다. 알림 종류가 늘어날수록 화면이 복잡해지고 탐색이 어려워진다.

## 결정

iOS 설정 앱 스타일의 **리스트 → 상세 네비게이션 패턴**으로 리팩토링한다. Expo Router 폴더 기반 라우팅을 활용하여 각 알림 종류를 별도 화면으로 분리한다.

### 대안 검토

| 방안 | 설명 | 탈락 사유 |
|------|------|----------|
| 수평 탭 | 상단 탭바로 알림 종류별 전환 | 탭 수가 적어 과한 구조 |
| 아코디언 | 섹션 접었다 펼치기 | 스크롤이 여전히 길어짐 |
| 상태 기반 전환 | 단일 파일에서 state로 뷰 전환 | 뒤로가기 제스처 부자연스러움, Expo Router 패턴과 불일치 |

## 라우팅 구조

```
settings/notifications/
  _layout.tsx      ← Stack 네비게이션
  index.tsx        ← 메인 리스트 화면
  push.tsx         ← 푸시 알림 상세
  weather.tsx      ← 날씨 알림 상세
  reminder.tsx     ← 리마인드 알림 상세
```

기존 `settings/notifications.tsx`는 삭제한다. Expo Router에서 `notifications.tsx`와 `notifications/index.tsx`는 충돌하므로 반드시 동시에 삭제/생성해야 한다.

> **참고**: `app/(app)/notifications/`(알림 수신함 화면)과 `app/(app)/settings/notifications/`(알림 설정 화면)는 경로가 다르므로 충돌하지 않는다.

## 화면 설계

### 메인 리스트 (index.tsx)

```
┌──────────────────────────────┐
│  알림 설정                    │
├──────────────────────────────┤
│                              │
│  ┌────────────────────────┐  │
│  │ 24시간제          [토글] │  │
│  └────────────────────────┘  │
│                              │
│  ┌────────────────────────┐  │
│  │ 푸시 알림     켜짐  >   │  │
│  ├────────────────────────┤  │
│  │ 날씨 알림     꺼짐  >   │  │
│  ├────────────────────────┤  │
│  │ 리마인드 알림           │  │
│  │        08:00, 18:00  >  │  │
│  └────────────────────────┘  │
│                              │
└──────────────────────────────┘
```

- **24시간제**: 독립 토글. 상세 화면 불필요.
- **푸시 알림**: 상태 요약 `켜짐` / `꺼짐`
- **날씨 알림**: 상태 요약 `켜짐` / `꺼짐`
- **리마인드 알림**: 설정된 시간 표시 (예: `08:00, 18:00`)
- 각 항목 탭 시 `router.push`로 상세 화면 진입
- `useSuspenseQuery(useGetPreferenceQueryOptions())`로 데이터 조회. TanStack Query 캐시 공유로 상세 화면 진입 시 중복 fetch 없음
- `QueryErrorBoundary` + `Suspense`로 감싸되, 로딩 상태는 기존 스켈레톤 패턴 재사용

### 푸시 알림 상세 (push.tsx)

```
┌──────────────────────────────┐
│  ← 푸시 알림                  │
├──────────────────────────────┤
│                              │
│  ┌────────────────────────┐  │
│  │ 푸시 알림          [토글] │  │
│  │ 모든 푸시 알림을 받아요   │  │
│  ├────────────────────────┤  │
│  │ 야간 푸시 알림     [토글] │  │
│  │ 21:00-08:00에도 알림     │  │
│  └────────────────────────┘  │
│                              │
└──────────────────────────────┘
```

기존 `notifications.tsx`의 푸시 알림 카드 그대로 이동.

### 날씨 알림 상세 (weather.tsx)

```
┌──────────────────────────────┐
│  ← 날씨 알림                  │
├──────────────────────────────┤
│                              │
│  ┌────────────────────────┐  │
│  │ 날씨 알림          [토글] │  │
│  │ 날씨 알림을 받아요        │  │
│  ├────────────────────────┤  │
│  │ 오전 날씨 알림   08:00 > │  │
│  │ 오늘의 날씨를 알려줘요    │  │
│  ├────────────────────────┤  │
│  │ 오후 날씨 알림   18:00 > │  │
│  │ 내일의 날씨를 알려줘요    │  │
│  └────────────────────────┘  │
│                              │
└──────────────────────────────┘
```

기존 날씨 알림 섹션 이동. 날씨 토글 + 시간 설정.

### 리마인드 알림 상세 (reminder.tsx)

```
┌──────────────────────────────┐
│  ← 리마인드 알림              │
├──────────────────────────────┤
│                              │
│  ┌────────────────────────┐  │
│  │ 오전 리마인드    08:00 > │  │
│  │ 00:00~11:59에 할일 알림  │  │
│  ├────────────────────────┤  │
│  │ 오후 리마인드    18:00 > │  │
│  │ 12:00~23:59에 할일 알림  │  │
│  └────────────────────────┘  │
│                              │
└──────────────────────────────┘
```

기존 리마인드 섹션 이동. 프리미엄 게이트(`UserPolicy.isPremiumUser` 체크 + `CrownIcon` 표시 + `premiumDialog`) 그대로 유지.

## 공통 컴포넌트 추출

기존 `notifications.tsx`에 정의된 로컬 컴포넌트들을 `features/notification/presentations/components/`로 추출하여 각 상세 화면에서 재사용한다.

| 컴포넌트 | 용도 |
|----------|------|
| `Card` | 설정 카드 래퍼 |
| `Toggle` | on/off 토글 행 |
| `TimeRow` | 시간 표시 + 화살표 행 |
| `SettingsTimePicker` | 시간 선택 (iOS 바텀시트 / Android 네이티브 피커) |
| `TimePicker` | DateTimePicker 래퍼 (iOS) |
| `AndroidTimePicker` | DateTimePicker 래퍼 (Android) |
| `SectionHeader` | 섹션 제목 + 설명 |

`ReminderTimePicker`, `WeatherTimePicker`는 각 상세 화면에 인라인으로 유지한다 (해당 화면에서만 사용).

추출 컴포넌트들은 알림 설정 전용이므로 `features/notification/presentations/components/settings/`에 배치한다. 기존 알림 수신함 컴포넌트(`notification-bell.tsx`, `notification-item.tsx` 등)와 분리.

### 메인 리스트 전용 컴포넌트

`index.tsx`의 네비게이션 행은 새로운 `NavigationRow` 컴포넌트로 구현한다.

```tsx
interface NavigationRowProps {
  label: string;
  summary: string;      // "켜짐", "꺼짐", "08:00, 18:00"
  onPress: () => void;
  isDisabled?: boolean;
}
```

## 변경 범위

| 파일 | 변경 |
|------|------|
| `settings/notifications.tsx` | 삭제 |
| `settings/notifications/_layout.tsx` | 신규 - Stack 레이아웃 |
| `settings/notifications/index.tsx` | 신규 - 메인 리스트 |
| `settings/notifications/push.tsx` | 신규 - 푸시 상세 |
| `settings/notifications/weather.tsx` | 신규 - 날씨 상세 |
| `settings/notifications/reminder.tsx` | 신규 - 리마인드 상세 |
| `settings/_layout.tsx` | `notifications` Screen 설정 조정 (headerShown: false) |
| `features/notification/presentations/components/` | 공통 컴포넌트 추출 |

## 상태 처리

### 로딩 상태
- 모든 화면: `QueryErrorBoundary` + `Suspense` 래핑
- `index.tsx`: 기존 `ToggleSkeleton` 재사용하여 리스트 스켈레톤
- 상세 화면: 기존 스켈레톤 컴포넌트(`ToggleSkeleton`, `GroupSkeleton`) 추출하여 재사용

### Disabled 상태 (푸시 꺼짐 시)
- `index.tsx`: 날씨/리마인드 행의 summary 텍스트를 `opacity-40`으로 표시
- 상세 화면: 기존과 동일하게 각 컨트롤의 `isDisabled` prop으로 처리

### Mutation 독립성
각 상세 화면이 독립된 `updateMutation` 인스턴스를 가진다. 푸시 설정 변경 중에 날씨 컨트롤이 비활성화되지 않는다 (기존 대비 개선).

## 주의사항

- `settings/_layout.tsx`에서 `notifications` Screen에만 `headerShown: false` 추가 (다른 Screen은 영향 없음)
- `notifications/_layout.tsx`는 부모 레이아웃의 헤더 스타일(`useFontScale`, `useResolveClassNames`, custom `headerLeft`)을 동일하게 적용
- 기존 `useUpdatePreferenceMutationOptions`, `useGetPreferenceQueryOptions` 등 쿼리 훅은 변경 없이 그대로 사용
- 기존 딥링크(`/settings/notifications`)는 `notifications/index.tsx`로 자동 라우팅되므로 변경 불필요
