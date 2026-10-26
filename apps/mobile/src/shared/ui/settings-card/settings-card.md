# SettingsCard

설정 화면에서 토글·행을 흰 카드 한 장으로 묶는 Compound Component예요. 행 사이 구분선은 heroui-native `Separator`를 그대로 써요.

## 사용법

```tsx
import { SettingsCard } from '@src/shared/ui';
import { Separator } from 'heroui-native';

<SettingsCard>
  <SettingsCard.Toggle
    label={t('push.todo.label')}
    description={t('push.todo.description')}
    isSelected={preference.todoPushEnabled}
    onSelectedChange={(isSelected) => update({ todoPushEnabled: isSelected })}
    isDisabled={updateMutation.isPending}
  />
  <Separator />
  <SettingsCard.Toggle
    label={t('push.nudge.label')}
    isSelected={nudgeEnabled}
    onSelectedChange={setNudgeEnabled}
  />
</SettingsCard>;
```

### 로딩

`.ToggleSkeleton`은 `.Toggle`과 같은 높이·배치라 Suspense가 풀릴 때 화면이 밀리지 않아요.

```tsx
<Suspense
  fallback={
    <SettingsCard>
      <SettingsCard.ToggleSkeleton hasDescription />
    </SettingsCard>
  }
>
  <PushSettings />
</Suspense>
```

## API

### SettingsCard

| Prop        | Type        | Default | Description  |
| ----------- | ----------- | ------- | ------------ |
| `children`  | `ReactNode` | -       | 카드 안의 행 |
| `className` | `string`    | -       | 추가 클래스  |

### SettingsCard.Toggle

heroui-native `ControlField`의 props를 그대로 받아요(`isSelected`, `onSelectedChange`, `isDisabled` 등). `children`만 이 컴포넌트가 채워요.

| Prop          | Type     | Default | Description               |
| ------------- | -------- | ------- | ------------------------- |
| `label`       | `string` | -       | 토글 제목                 |
| `description` | `string` | -       | 제목 아래 보조 설명(선택) |

### SettingsCard.ToggleSkeleton

| Prop             | Type      | Default | Description                    |
| ---------------- | --------- | ------- | ------------------------------ |
| `hasDescription` | `boolean` | `false` | 보조 설명 줄까지 자리를 잡을지 |

## 파일 구조

```
settings-card/
├── index.ts
├── settings-card.tsx   # SettingsCard, .Toggle, .ToggleSkeleton
└── settings-card.md
```
