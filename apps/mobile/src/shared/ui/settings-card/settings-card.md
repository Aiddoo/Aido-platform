# SettingsCard

설정 화면의 흰 카드와 행을 한 모양으로 맞추는 Compound Component예요. heroui-native `ListGroup`·`ControlField`·`Separator` 위에 글자 크기 설정(`Text`)과 선택·비활성 표시만 더해요. `SettingsScreenLayout`은 설정 화면의 스크롤 틀이에요.

## 사용법

```tsx
import { SettingsCard, SettingsScreenLayout } from '@src/shared/ui';

<SettingsScreenLayout>
  <SettingsCard label={t('section')}>
    <SettingsCard.Item label={t('theme')} icon={<MoonIcon />} onPress={openTheme} />
    <SettingsCard.Separator />
    <SettingsCard.Toggle label={t('push')} isSelected={isOn} onSelectedChange={setIsOn} />
  </SettingsCard>
</SettingsScreenLayout>;
```

행은 `map`으로 돌리지 않고 나란히 둬요. 기획이 바뀌면 그 줄만 고치면 돼요.

### 로딩

`.ItemSkeleton`·`.ToggleSkeleton`은 실제 행과 높이·여백이 같아 Suspense가 풀릴 때 화면이 밀리지 않아요. 실패는 `fallback={SettingsCard.Error}`로 카드 자리에 안내(다시 시도 + 문의하기)를 보여요.

```tsx
<QueryErrorBoundary fallback={SettingsCard.Error}>
  <Suspense
    fallback={
      <SettingsCard>
        <SettingsCard.ToggleSkeleton hasDescription />
      </SettingsCard>
    }
  >
    <PushSettings />
  </Suspense>
</QueryErrorBoundary>
```

## API

### SettingsCard

`ListGroup` props와 같아요.

| Prop    | Type     | Default | Description    |
| ------- | -------- | ------- | -------------- |
| `label` | `string` | -       | 카드 위쪽 제목 |

### SettingsCard.Item

`ListGroup.Item` props와 같아요(`onPress`, `testID` 등). `disabled` 대신 `isDisabled`를 써요.

| Prop          | Type        | Default | Description                      |
| ------------- | ----------- | ------- | -------------------------------- |
| `label`       | `string`    | -       | 항목 제목                        |
| `description` | `string`    | -       | 제목 아래 보조 설명              |
| `icon`        | `ReactNode` | -       | 앞 아이콘. 메뉴는 `text-main` 톤 |
| `value`       | `ReactNode` | -       | 화살표 앞에 두는 현재 값         |
| `right`       | `ReactNode` | 화살표  | 오른쪽 전체를 바꿀 때            |
| `isSelected`  | `boolean`   | `false` | 넓은 화면의 선택 표시            |
| `isDisabled`  | `boolean`   | `false` | 누를 수 없음                     |

### SettingsCard.ItemSkeleton

| Prop               | Type      | Default | Description             |
| ------------------ | --------- | ------- | ----------------------- |
| `descriptionLines` | `number`  | `0`     | 보조 설명 줄 수         |
| `hasValue`         | `boolean` | `false` | 현재 값 자리까지 잡을지 |

### SettingsCard.Toggle

`ControlField` props를 그대로 받아요(`isSelected`, `onSelectedChange`, `isDisabled` 등). `children`만 이 컴포넌트가 채워요.

| Prop          | Type     | Default | Description         |
| ------------- | -------- | ------- | ------------------- |
| `label`       | `string` | -       | 토글 제목           |
| `description` | `string` | -       | 제목 아래 보조 설명 |

### SettingsCard.ToggleSkeleton

| Prop             | Type      | Default | Description             |
| ---------------- | --------- | ------- | ----------------------- |
| `hasDescription` | `boolean` | `false` | 보조 설명 줄까지 잡을지 |

### SettingsCard.Content

행 모양이 아닌 내용을 행과 같은 여백으로 담아요. `VStack` props와 같아요.

### SettingsCard.Error

`QueryErrorBoundary`의 `fallback`으로 넘겨요. 제목·설명과 `QueryErrorActions`(다시 시도 + 문의하기)를 카드 안에 그려요.

### SettingsCard.Separator

행 사이 구분선이에요. 좌우 16 들여쓰기예요.

### SettingsScreenLayout

`ScrollView` props와 같아요. `gap`(기본 12)은 카드 사이 간격이에요. 스크롤바와 배경은 가장자리까지 두고 내용만 가로 safe area를 피하며(공식 iPhone Duo 안내), `ReadableContent`로 넓은 화면의 폭을 모아요.

## 파일 구조

```
settings-card/
├── index.ts
├── settings-card.tsx   # SettingsCard, .Item, .Toggle, 스켈레톤, SettingsScreenLayout
└── settings-card.md
```
