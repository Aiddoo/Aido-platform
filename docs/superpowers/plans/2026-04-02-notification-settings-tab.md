# 알림 설정 리스트→상세 리팩토링 구현 플랜

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 알림 설정 화면을 단일 스크롤 뷰에서 리스트→상세 네비게이션 패턴으로 리팩토링한다.

**Architecture:** Expo Router 폴더 기반 라우팅으로 `settings/notifications.tsx`를 `settings/notifications/` 폴더로 분리. 기존 로컬 컴포넌트를 공통 모듈로 추출하여 각 화면에서 재사용.

**Tech Stack:** Expo Router, React Native, TanStack Query v5, NativeWind, HeroUI Native, @react-native-community/datetimepicker

**Spec:** `docs/superpowers/specs/2026-04-02-notification-settings-tab-design.md`

---

## File Map

| 파일 | 역할 | 작업 |
|------|------|------|
| `apps/mobile/app/(app)/settings/notifications.tsx` | 기존 단일 화면 | 삭제 |
| `apps/mobile/app/(app)/settings/_layout.tsx` | settings Stack 레이아웃 | 수정 — notifications에 headerShown: false |
| `apps/mobile/src/features/notification/presentations/components/settings/SettingsCard.tsx` | 설정 카드 래퍼 | 신규 |
| `apps/mobile/src/features/notification/presentations/components/settings/SettingsToggle.tsx` | on/off 토글 행 | 신규 |
| `apps/mobile/src/features/notification/presentations/components/settings/SettingsTimeRow.tsx` | 시간 표시 + 화살표 행 | 신규 |
| `apps/mobile/src/features/notification/presentations/components/settings/SettingsTimePicker.tsx` | 시간 선택 (iOS/Android) | 신규 |
| `apps/mobile/src/features/notification/presentations/components/settings/NavigationRow.tsx` | 리스트 네비게이션 행 | 신규 |
| `apps/mobile/src/features/notification/presentations/components/settings/SettingsSkeleton.tsx` | 스켈레톤 컴포넌트 | 신규 |
| `apps/mobile/src/features/notification/presentations/components/settings/index.ts` | barrel export | 신규 |
| `apps/mobile/app/(app)/settings/notifications/_layout.tsx` | notifications Stack 레이아웃 | 신규 |
| `apps/mobile/app/(app)/settings/notifications/index.tsx` | 메인 리스트 화면 | 신규 |
| `apps/mobile/app/(app)/settings/notifications/push.tsx` | 푸시 알림 상세 | 신규 |
| `apps/mobile/app/(app)/settings/notifications/weather.tsx` | 날씨 알림 상세 | 신규 |
| `apps/mobile/app/(app)/settings/notifications/reminder.tsx` | 리마인드 알림 상세 | 신규 |

---

### Task 1: 공통 컴포넌트 추출

기존 `notifications.tsx`에서 재사용 가능한 컴포넌트를 `features/notification/presentations/components/settings/`로 추출한다.

**Files:**
- Source: `apps/mobile/app/(app)/settings/notifications.tsx` (읽기 전용 — 아직 삭제하지 않음)
- Create: `apps/mobile/src/features/notification/presentations/components/settings/SettingsCard.tsx`
- Create: `apps/mobile/src/features/notification/presentations/components/settings/SettingsToggle.tsx`
- Create: `apps/mobile/src/features/notification/presentations/components/settings/SettingsTimeRow.tsx`
- Create: `apps/mobile/src/features/notification/presentations/components/settings/SettingsTimePicker.tsx`
- Create: `apps/mobile/src/features/notification/presentations/components/settings/NavigationRow.tsx`
- Create: `apps/mobile/src/features/notification/presentations/components/settings/SettingsSkeleton.tsx`
- Create: `apps/mobile/src/features/notification/presentations/components/settings/index.ts`

**참조 파일:**
- `apps/mobile/app/(app)/settings/notifications.tsx:391-397` — Card
- `apps/mobile/app/(app)/settings/notifications.tsx:413-436` — Toggle
- `apps/mobile/app/(app)/settings/notifications.tsx:438-478` — TimeRow
- `apps/mobile/app/(app)/settings/notifications.tsx:212-322` — SettingsTimePicker (+ TimePicker, AndroidTimePicker)
- `apps/mobile/app/(app)/settings/notifications.tsx:480-522` — ToggleSkeleton, GroupSkeleton
- `apps/mobile/app/(app)/settings/notifications.tsx:399-411` — SectionHeader

- [ ] **Step 1: SettingsCard.tsx 생성**

`notifications.tsx`의 `Card` 컴포넌트를 추출. `PropsWithChildren` 받아서 흰색 라운드 카드 렌더링.

```tsx
// SettingsCard.tsx
import type { PropsWithChildren } from 'react';
import { VStack } from '@src/shared/ui';

export function SettingsCard({ children }: PropsWithChildren) {
  return (
    <VStack p={16} gap={12} className="bg-white rounded-2xl">
      {children}
    </VStack>
  );
}
```

- [ ] **Step 2: SettingsToggle.tsx 생성**

`notifications.tsx`의 `Toggle` 컴포넌트를 추출.

```tsx
// SettingsToggle.tsx
import type { ComponentProps } from 'react';
import { View } from 'react-native';
import { ControlField, Description, Label } from 'heroui-native';

interface SettingsToggleProps
  extends Pick<
    ComponentProps<typeof ControlField>,
    'isSelected' | 'onSelectedChange' | 'isDisabled'
  > {
  label: string;
  description?: string;
}

export function SettingsToggle({
  label,
  description,
  isSelected,
  onSelectedChange,
  isDisabled,
}: SettingsToggleProps) {
  return (
    <ControlField
      isSelected={isSelected}
      onSelectedChange={onSelectedChange}
      isDisabled={isDisabled}
    >
      <View className="flex-1">
        <Label>{label}</Label>
        {description && <Description>{description}</Description>}
      </View>
      <ControlField.Indicator />
    </ControlField>
  );
}
```

- [ ] **Step 3: SettingsTimeRow.tsx 생성**

`notifications.tsx`의 `TimeRow` 컴포넌트를 추출.

```tsx
// SettingsTimeRow.tsx
import type { ComponentProps, ReactNode } from 'react';
import { View } from 'react-native';
import { Description, Label, PressableFeedback } from 'heroui-native';
import { ArrowRightIcon, HStack, VStack } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { formatReminderTime, type TimeFormat } from '@src/shared/utils/time';

interface SettingsTimeRowProps
  extends Pick<ComponentProps<typeof PressableFeedback>, 'onPress' | 'isDisabled'> {
  label: string;
  description: string;
  hour: number;
  minute: number;
  timeFormat: TimeFormat;
  accessory?: ReactNode;
}

export function SettingsTimeRow({
  label,
  description,
  hour,
  minute,
  timeFormat,
  isDisabled,
  accessory,
  onPress,
}: SettingsTimeRowProps) {
  return (
    <PressableFeedback onPress={onPress} isDisabled={isDisabled} className="rounded-lg">
      <PressableFeedback.Highlight className="rounded-lg" />
      <HStack justify="between" align="center" className={cn(isDisabled && 'opacity-40')} gap={20}>
        <VStack className="flex-1">
          <HStack gap={8} align="center">
            <Label>{label}</Label>
            {accessory}
            <Description className="text-main break-keep">
              {formatReminderTime(hour, minute, timeFormat)}
            </Description>
          </HStack>
          <Description lineBreakStrategyIOS="hangul-word" textBreakStrategy="highQuality">
            {description}
          </Description>
        </VStack>
        <ArrowRightIcon colorClassName="text-gray-6" />
      </HStack>
    </PressableFeedback>
  );
}
```

- [ ] **Step 4: SettingsTimePicker.tsx 생성**

`notifications.tsx`의 `SettingsTimePicker`, `TimePicker`, `AndroidTimePicker`를 하나의 파일로 추출. 이 컴포넌트는 여러 상세 화면에서 공유된다.

기존 `notifications.tsx:177-322`의 코드를 복사하되, 다음 import 변경을 적용:
- `TimeRow` 참조 → `SettingsTimeRow`로 변경, `'./SettingsTimeRow'`에서 import
- 나머지 import 경로는 기존과 동일 유지 (`@src/shared/ui`, `@src/shared/utils/time`, `@tanstack/react-query` 등)
- `PickerHeader`는 기존과 동일하게 `@src/features/todo/presentations/components/PickerHeader`에서 import
- `useGetPreferenceQueryOptions`, `useUpdatePreferenceMutationOptions`는 기존과 동일 경로에서 import
- `type TimePickerProps`, `TimePicker`, `AndroidTimePicker`, `SettingsTimePickerProps`, `SettingsTimePicker` 모두 포함
- `SettingsTimePicker`만 export, 나머지는 파일 내부에서만 사용

- [ ] **Step 5: NavigationRow.tsx 생성**

메인 리스트 전용 네비게이션 행 컴포넌트. 라벨 + 상태 요약 + 화살표.

```tsx
// NavigationRow.tsx
import { View } from 'react-native';
import { Description, Label, PressableFeedback } from 'heroui-native';
import { ArrowRightIcon, HStack } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';

interface NavigationRowProps {
  label: string;
  summary: string;
  onPress: () => void;
  isDisabled?: boolean;
}

export function NavigationRow({ label, summary, onPress, isDisabled }: NavigationRowProps) {
  return (
    <PressableFeedback onPress={onPress} isDisabled={isDisabled} className="rounded-lg">
      <PressableFeedback.Highlight className="rounded-lg" />
      <HStack justify="between" align="center" className={cn(isDisabled && 'opacity-40')} gap={20}>
        <Label>{label}</Label>
        <HStack gap={8} align="center">
          <Description>{summary}</Description>
          <ArrowRightIcon colorClassName="text-gray-6" />
        </HStack>
      </HStack>
    </PressableFeedback>
  );
}
```

- [ ] **Step 6: SettingsSkeleton.tsx 생성**

`notifications.tsx`의 `ToggleSkeleton`, `GroupSkeleton` + 리스트용 `NavigationSkeleton` 추출.

```tsx
// SettingsSkeleton.tsx
import { View } from 'react-native';
import { Separator, Skeleton, SkeletonGroup } from 'heroui-native';
import { HStack, VStack } from '@src/shared/ui';
import { times } from 'es-toolkit/compat';
import { SettingsCard } from './SettingsCard';

export function ToggleSkeleton() {
  return (
    <SkeletonGroup isLoading isSkeletonOnly>
      <HStack justify="between" align="center" className="py-2">
        <VStack flex={1} gap={2}>
          <Skeleton className="h-5 w-24 rounded" />
          <Skeleton className="h-4 w-48 rounded" />
        </VStack>
        <Skeleton className="h-8 w-14 rounded-full" />
      </HStack>
    </SkeletonGroup>
  );
}

export function GroupSkeleton({ rows }: { rows: number }) {
  return (
    <VStack gap={8}>
      <SkeletonGroup isLoading isSkeletonOnly>
        <VStack gap={2} className="px-2">
          <Skeleton className="h-5 w-24 rounded" />
          <Skeleton className="h-4 w-52 rounded" />
        </VStack>
      </SkeletonGroup>

      <SettingsCard>
        <SkeletonGroup isLoading isSkeletonOnly>
          {times(rows, (i) => (
            <View key={i}>
              {i > 0 && <Separator className="bg-gray-2" />}
              <HStack justify="between" align="center" className="py-2">
                <VStack flex={1} gap={2}>
                  <Skeleton className="h-5 w-28 rounded" />
                  <Skeleton className="h-4 w-44 rounded" />
                </VStack>
                <Skeleton className="h-5 w-16 rounded" />
              </HStack>
            </View>
          ))}
        </SkeletonGroup>
      </SettingsCard>
    </VStack>
  );
}

export function NavigationSkeleton() {
  return (
    <SkeletonGroup isLoading isSkeletonOnly>
      <HStack justify="between" align="center" className="py-2">
        <Skeleton className="h-5 w-24 rounded" />
        <Skeleton className="h-5 w-12 rounded" />
      </HStack>
    </SkeletonGroup>
  );
}
```

- [ ] **Step 7: index.ts barrel export 생성**

```tsx
// index.ts
export { SettingsCard } from './SettingsCard';
export { SettingsToggle } from './SettingsToggle';
export { SettingsTimeRow } from './SettingsTimeRow';
export { SettingsTimePicker } from './SettingsTimePicker';
export { NavigationRow } from './NavigationRow';
export { ToggleSkeleton, GroupSkeleton, NavigationSkeleton } from './SettingsSkeleton';
```

> **참고**: 기존 `SectionHeader`는 상세 화면에서 사용하지 않으므로 추출하지 않는다. 상세 화면에서는 설명 텍스트를 토글의 `description` prop으로 직접 전달한다.

- [ ] **Step 8: typecheck 실행**

Run: `cd /Users/hijjoy/Documents/Aido-platform && pnpm typecheck --filter=@aido/mobile`
Expected: 타입 에러 없음

- [ ] **Step 9: 커밋**

```bash
git add apps/mobile/src/features/notification/presentations/components/settings/
git commit -m "refactor(mobile): 알림 설정 공통 컴포넌트 추출"
```

---

### Task 2: 라우팅 구조 전환 (notifications.tsx → notifications/ 폴더)

기존 단일 파일을 삭제하고 폴더 기반 라우팅으로 전환한다. 이 단계에서는 `_layout.tsx`와 빈 `index.tsx`만 생성하여 라우팅이 작동하는지 확인한다.

**Files:**
- Delete: `apps/mobile/app/(app)/settings/notifications.tsx`
- Modify: `apps/mobile/app/(app)/settings/_layout.tsx:34`
- Create: `apps/mobile/app/(app)/settings/notifications/_layout.tsx`
- Create: `apps/mobile/app/(app)/settings/notifications/index.tsx` (임시 플레이스홀더)

- [ ] **Step 1: notifications.tsx 내용을 먼저 읽어 컨텍스트에 로드한 후, 삭제 + 폴더 생성을 동시에 수행**

> **중요**: 이후 Task 3-6에서 기존 코드를 참조하므로, 삭제 전 `notifications.tsx` 전체 내용을 읽어 컨텍스트에 보유해야 한다.

```bash
rm apps/mobile/app/\(app\)/settings/notifications.tsx
mkdir -p apps/mobile/app/\(app\)/settings/notifications
```

- [ ] **Step 2: settings/_layout.tsx에서 notifications Screen에 headerShown: false 추가**

기존:
```tsx
<Stack.Screen name="notifications" options={{ title: '알림 설정' }} />
```
변경:
```tsx
<Stack.Screen name="notifications" options={{ headerShown: false }} />
```

- [ ] **Step 3: notifications/_layout.tsx 생성**

부모 settings/_layout.tsx의 헤더 스타일을 동일하게 적용한다.

```tsx
// notifications/_layout.tsx
import { useFontScale } from '@src/shared/providers/font-scale-provider';
import { ArrowLeftIcon } from '@src/shared/ui';
import { getScaledFontSize } from '@src/shared/utils/font-scale';
import { router, Stack } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useResolveClassNames } from 'uniwind';

export default function NotificationsLayout() {
  const headerBg = useResolveClassNames('bg-gray-1');
  const titleColor = useResolveClassNames('text-gray-9');
  const { fontScale } = useFontScale();

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerShadowVisible: false,
        headerStyle: { backgroundColor: headerBg.backgroundColor as string },
        headerTitleStyle: {
          fontSize: getScaledFontSize(fontScale),
          fontWeight: '600',
          color: titleColor.color as string,
        },
        headerTitleAlign: 'center',
        headerLeft: () => (
          <View className="justify-center items-center">
            <Pressable onPress={() => router.back()} hitSlop={8} className="p-2">
              <ArrowLeftIcon width={20} height={20} colorClassName="text-gray-9" />
            </Pressable>
          </View>
        ),
      }}
    >
      <Stack.Screen name="index" options={{ title: '알림 설정' }} />
      <Stack.Screen name="push" options={{ title: '푸시 알림' }} />
      <Stack.Screen name="weather" options={{ title: '날씨 알림' }} />
      <Stack.Screen name="reminder" options={{ title: '리마인드 알림' }} />
    </Stack>
  );
}
```

- [ ] **Step 4: notifications/index.tsx 임시 플레이스홀더 생성**

라우팅 확인용 최소 화면.

```tsx
import { Text } from 'react-native';
import { StyledSafeAreaView } from '@src/shared/ui';

export default function NotificationSettingsScreen() {
  return (
    <StyledSafeAreaView className="flex-1 bg-gray-1" edges={['bottom']}>
      <Text>알림 설정 (WIP)</Text>
    </StyledSafeAreaView>
  );
}
```

- [ ] **Step 5: typecheck 실행**

Run: `cd /Users/hijjoy/Documents/Aido-platform && pnpm typecheck --filter=@aido/mobile`
Expected: 타입 에러 없음

- [ ] **Step 6: 커밋**

```bash
git add -A apps/mobile/app/\(app\)/settings/notifications* apps/mobile/app/\(app\)/settings/_layout.tsx
git commit -m "refactor(mobile): 알림 설정 라우팅 구조 폴더 기반으로 전환"
```

---

### Task 3: 메인 리스트 화면 (index.tsx)

플레이스홀더를 실제 리스트 화면으로 교체한다.

**Files:**
- Modify: `apps/mobile/app/(app)/settings/notifications/index.tsx`

- [ ] **Step 1: index.tsx를 실제 리스트 화면으로 구현**

24시간제 토글 + 푸시/날씨/리마인드 네비게이션 행. `useSuspenseQuery`로 preference 조회. `QueryErrorBoundary` + `Suspense` 래핑. 상태 요약 표시.

참조할 기존 코드:
- 24시간제 토글: 기존 `notifications.tsx:72-81`
- preference 조회: `useSuspenseQuery(useGetPreferenceQueryOptions())`

핵심 로직:
- `isWeatherEnabled`를 `@src/features/auth/models/auth.model`에서 import
- `formatReminderTime`을 `@src/shared/utils/time`에서 import
- 푸시 상태: `preference.pushEnabled ? '켜짐' : '꺼짐'`
- 날씨 상태: `isWeatherEnabled(preference) ? '켜짐' : '꺼짐'`
- 리마인드 상태: `formatReminderTime(morningH, morningM, tf) + ', ' + formatReminderTime(eveningH, eveningM, tf)`
- 날씨/리마인드 행: `isDisabled={!preference.pushEnabled}`
- `Suspense` fallback: `ToggleSkeleton` 1개 + `NavigationSkeleton` 3개를 Card 안에 배치

- [ ] **Step 2: typecheck 실행**

Run: `cd /Users/hijjoy/Documents/Aido-platform && pnpm typecheck --filter=@aido/mobile`
Expected: 타입 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add apps/mobile/app/\(app\)/settings/notifications/index.tsx
git commit -m "refactor(mobile): 알림 설정 메인 리스트 화면 구현"
```

---

### Task 4: 푸시 알림 상세 화면 (push.tsx)

**Files:**
- Create: `apps/mobile/app/(app)/settings/notifications/push.tsx`

- [ ] **Step 1: push.tsx 구현**

기존 `notifications.tsx:84-103`의 푸시 알림 카드를 그대로 이동. `SettingsCard`, `SettingsToggle` 사용. `QueryErrorBoundary` + `Suspense` 래핑.

핵심 로직:
- 푸시 알림 토글: `preference.pushEnabled` ↔ `updateMutation.mutate({ pushEnabled })`
- 야간 푸시 토글: `preference.nightPushEnabled` ↔ `updateMutation.mutate({ nightPushEnabled })`
- 야간 푸시 disabled: `PreferencePolicy.isPushDisabled(preference) || updateMutation.isPending`
- `Suspense` fallback: `ToggleSkeleton` 2개를 `SettingsCard` 안에 배치 (Separator 포함)

- [ ] **Step 2: typecheck 실행**

Run: `cd /Users/hijjoy/Documents/Aido-platform && pnpm typecheck --filter=@aido/mobile`

- [ ] **Step 3: 커밋**

```bash
git add apps/mobile/app/\(app\)/settings/notifications/push.tsx
git commit -m "refactor(mobile): 푸시 알림 상세 설정 화면 구현"
```

---

### Task 5: 날씨 알림 상세 화면 (weather.tsx)

**Files:**
- Create: `apps/mobile/app/(app)/settings/notifications/weather.tsx`

- [ ] **Step 1: weather.tsx 구현**

기존 `notifications.tsx:105-138`의 날씨 섹션 이동. `SettingsCard`, `SettingsToggle`, `SettingsTimePicker` 사용. `WeatherTimePicker` 인라인 유지.

핵심 로직:
- 날씨 알림 토글: `isWeatherEnabled(preference)` ↔ `updateMutation.mutate({ weatherMorningEnabled, weatherEveningEnabled, trackAs: 'weatherEnabled' })`
- 오전/오후 시간 피커: `WeatherTimePicker` (기존 `notifications.tsx:365-389` 참조)
- disabled: `PreferencePolicy.isWeatherDisabled`
- `Suspense` fallback: `GroupSkeleton` rows={3} 재사용

- [ ] **Step 2: typecheck 실행**

Run: `cd /Users/hijjoy/Documents/Aido-platform && pnpm typecheck --filter=@aido/mobile`

- [ ] **Step 3: 커밋**

```bash
git add apps/mobile/app/\(app\)/settings/notifications/weather.tsx
git commit -m "refactor(mobile): 날씨 알림 상세 설정 화면 구현"
```

---

### Task 6: 리마인드 알림 상세 화면 (reminder.tsx)

**Files:**
- Create: `apps/mobile/app/(app)/settings/notifications/reminder.tsx`

- [ ] **Step 1: reminder.tsx 구현**

기존 `notifications.tsx:140-158`의 리마인드 섹션 이동. `SettingsCard`, `SettingsTimePicker` 사용. `ReminderTimePicker` 인라인 유지 (프리미엄 게이트 포함).

핵심 로직:
- 오전/오후 리마인드: `ReminderTimePicker` (기존 `notifications.tsx:324-363` 참조)
- 프리미엄 게이트: `UserPolicy.isPremiumUser` + `CrownIcon` + `premiumDialog`
- disabled: `PreferencePolicy.isPushDisabled`
- `Suspense` fallback: `GroupSkeleton` rows={2} 재사용

- [ ] **Step 2: typecheck 실행**

Run: `cd /Users/hijjoy/Documents/Aido-platform && pnpm typecheck --filter=@aido/mobile`

- [ ] **Step 3: 커밋**

```bash
git add apps/mobile/app/\(app\)/settings/notifications/reminder.tsx
git commit -m "refactor(mobile): 리마인드 알림 상세 설정 화면 구현"
```

---

### Task 7: 최종 검증

**Files:** 전체

- [ ] **Step 1: 전체 typecheck**

Run: `cd /Users/hijjoy/Documents/Aido-platform && pnpm typecheck`
Expected: 에러 없음

- [ ] **Step 2: 전체 lint**

Run: `cd /Users/hijjoy/Documents/Aido-platform && pnpm lint`
Expected: 에러 없음

- [ ] **Step 3: 기존 notifications.tsx에서 사용하던 import가 다른 파일에서 참조되지 않는지 확인**

Run: `grep -r "settings/notifications" apps/mobile/app apps/mobile/src --include="*.tsx" --include="*.ts"`
Expected: `settings/notifications` 경로 참조하는 곳이 라우터 네비게이션(`router.push`)뿐이고, 직접 import하는 곳 없음

- [ ] **Step 4: 변경 사항 요약 확인**

Run: `git diff --stat develop`
