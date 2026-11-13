# SettingsListGroup

설정 화면의 카드와 행을 한 모양으로 맞추는 Compound Component예요. heroui-native `ListGroup`·`ControlField`·`Separator` 위에 글자 크기 설정(`Text`)과 선택·비활성 표시만 더해요. `SettingsScreenLayout`은 설정 화면의 스크롤 틀이에요.

## 사용법

```tsx
import { SettingsListGroup, SettingsScreenLayout } from '@src/shared/ui';

<SettingsScreenLayout>
  <SettingsListGroup label={t('section')}>
    <SettingsListGroup.Item
      label={t('theme')}
      icon={<SettingsListGroup.Icon Icon={ThemeDuoIcon} />}
      onPress={openTheme}
    />
    <SettingsListGroup.Separator />
    <SettingsListGroup.Toggle label={t('push')} isSelected={isOn} onSelectedChange={setIsOn} />
  </SettingsListGroup>
</SettingsScreenLayout>;
```

행은 `map`으로 돌리지 않고 나란히 둬요. 기획이 바뀌면 그 줄만 고치면 돼요.

### 하나 고르기

테마·글꼴 크기·언어·앱 아이콘처럼 하나를 고르는 화면은 heroui `RadioGroup`(`className="gap-0"`)을 카드 안에 두고 `.Radio`를 나란히 써요. 값은 `RadioGroup`의 `value`/`onValueChange`로 주고받아요.

```tsx
<SettingsListGroup label={t('theme.label')}>
  <RadioGroup value={mode} onValueChange={handleChange} className="gap-0">
    <SettingsListGroup.Radio
      value="system"
      label={t('theme.system')}
      description={t('theme.systemDescription')}
      icon={<SettingsListGroup.Icon Icon={DeviceDuoIcon} />}
    />
    <SettingsListGroup.Separator />
    <SettingsListGroup.Radio value="light" label={t('theme.light')} />
  </RadioGroup>
</SettingsListGroup>
```

### 가상 목록

`FlashList`처럼 행을 따로 그리는 목록은 행마다 `.Segment`로 감싸 카드 한 장처럼 이어 붙여요. 첫 조각이 위 모서리와 `label`을, 마지막 조각이 아래 모서리를 맡고 사이에는 구분선이 들어가요. 비었을 때는 `.Empty`(점선 카드)를 `ListEmptyComponent`로 넘겨요.

```tsx
<FlashList
  data={notes}
  renderItem={({ item, index }) => (
    <SettingsListGroup.Segment
      label={t('voiceStorage.listLabel')}
      isFirst={index === 0}
      isLast={index === notes.length - 1}
    >
      <Row note={item} />
    </SettingsListGroup.Segment>
  )}
  ListEmptyComponent={
    <SettingsListGroup.Empty
      icon={<MemoIllustration size="block" />}
      title={t('voiceStorage.empty')}
    />
  }
/>
```

### 로딩

`.Item.Loading`·`.Toggle.Loading`은 실제 행과 높이·여백이 같아 Suspense가 풀릴 때 화면이 밀리지 않아요. 실패는 카드를 그리는 컴포넌트가 `X.Error = SettingsListGroup.Error`로 짝을 두고 화면은 `fallback={X.Error}`로 걸어 카드 자리에 안내(다시 시도 + 문의하기)를 보여요.

```tsx
<QueryErrorBoundary fallback={SettingsListGroup.Error}>
  <Suspense
    fallback={
      <SettingsListGroup>
        <SettingsListGroup.Toggle.Loading hasDescription />
      </SettingsListGroup>
    }
  >
    <PushSettings />
  </Suspense>
</QueryErrorBoundary>
```

## API

### SettingsListGroup

`ListGroup` props와 같아요.

| Prop    | Type     | Default | Description    |
| ------- | -------- | ------- | -------------- |
| `label` | `string` | -       | 카드 위쪽 제목 |

### SettingsListGroup.Item

`ListGroup.Item` props와 같아요(`onPress`, `testID` 등). `disabled` 대신 `isDisabled`를 써요.

| Prop          | Type        | Default | Description                                                                                                                                               |
| ------------- | ----------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `label`       | `string`    | -       | 항목 제목                                                                                                                                                 |
| `description` | `string`    | -       | 제목 아래 보조 설명                                                                                                                                       |
| `icon`        | `ReactNode` | -       | 앞 아이콘. 메뉴는 `<SettingsListGroup.Icon Icon={XDuoIcon} />`(옅은 `main` 바탕 30 + 듀오톤 아이콘 18, 글꼴 배율을 따른다). 듀오톤(`ic_duo_x.svg`)을 쓴다 |
| `value`       | `ReactNode` | -       | 화살표 앞에 두는 현재 값                                                                                                                                  |
| `right`       | `ReactNode` | 화살표  | 오른쪽 전체를 바꿀 때                                                                                                                                     |
| `isSelected`  | `boolean`   | `false` | 넓은 화면의 선택 표시                                                                                                                                     |
| `isDisabled`  | `boolean`   | `false` | 누를 수 없음                                                                                                                                              |

### SettingsListGroup.Item.Loading

| Prop               | Type      | Default | Description             |
| ------------------ | --------- | ------- | ----------------------- |
| `descriptionLines` | `number`  | `0`     | 보조 설명 줄 수         |
| `hasValue`         | `boolean` | `false` | 현재 값 자리까지 잡을지 |

### SettingsListGroup.Toggle

`ControlField` props를 그대로 받아요(`isSelected`, `onSelectedChange`, `isDisabled` 등). `children`만 이 컴포넌트가 채워요.

| Prop          | Type        | Default | Description                                                                                  |
| ------------- | ----------- | ------- | -------------------------------------------------------------------------------------------- |
| `label`       | `string`    | -       | 토글 제목                                                                                    |
| `description` | `ReactNode` | -       | 제목 아래 보조 설명. 상태에 따라 글자를 고르는 컴포넌트도 받아요(설명 글자 모양 안에 그려요) |
| `icon`        | `ReactNode` | -       | 앞 아이콘. `.Item`과 같은 `<SettingsListGroup.Icon Icon={XDuoIcon} />`                       |

### SettingsListGroup.Toggle.Loading

| Prop             | Type      | Default | Description             |
| ---------------- | --------- | ------- | ----------------------- |
| `hasDescription` | `boolean` | `false` | 보조 설명 줄까지 잡을지 |

### SettingsListGroup.Radio

`RadioGroup.Item` props와 같아요(`value`, `isDisabled`, `testID` 등). `.Item`과 같은 글자·여백에 오른쪽 화살표 자리만 [`ChoiceRadio`](../choice-radio/choice-radio.md)예요. `children`은 이 컴포넌트가 채워요.

| Prop          | Type        | Default | Description                                                                           |
| ------------- | ----------- | ------- | ------------------------------------------------------------------------------------- |
| `label`       | `string`    | -       | 항목 제목                                                                             |
| `description` | `string`    | -       | 제목 아래 보조 설명(b4)                                                               |
| `icon`        | `ReactNode` | -       | 앞 아이콘. 보통 `<SettingsListGroup.Icon Icon={XDuoIcon} />`                          |
| `badge`       | `ReactNode` | -       | 라디오 앞 짧은 표시(추천 `Chip` 등). 글자와 같은 흐름이라 큰 글꼴에서도 겹치지 않는다 |

### SettingsListGroup.Radio.Loading

| Prop   | Type        | Default | Description             |
| ------ | ----------- | ------- | ----------------------- |
| `icon` | `ReactNode` | -       | 앞 아이콘 자리 스켈레톤 |

### SettingsListGroup.Segment

가상 목록의 행 하나를 카드 조각으로 그려요. 받는 prop은 아래 셋과 `children`이에요.

| Prop      | Type      | Default | Description                     |
| --------- | --------- | ------- | ------------------------------- |
| `isFirst` | `boolean` | -       | 위 모서리를 둥글게, 제목을 그림 |
| `isLast`  | `boolean` | -       | 아래 모서리를 둥글게            |
| `label`   | `string`  | -       | 첫 조각에만 그리는 카드 제목    |

### SettingsListGroup.Empty

`Result` props와 같아요(`icon`, `title`, `description`, `testID`). 빈 목록을 점선 카드 안에 그려요.

### SettingsListGroup.Value

`.Item`의 `value`에 넣는 값 글자예요(현재 설정·개수·상태). `Text` props에서 `size`·`shade`를 뺀 것과 같아요(`b3`, `shade 7` 고정). 조회해야 아는 값은 값만 그리는 컴포넌트가 자기 경계로 읽어 이것을 돌려줘요(`FriendCountValue`).

```tsx
<SettingsListGroup.Item
  label={t('settings.weatherLabel')}
  value={<SettingsListGroup.Value>{t('settings.on')}</SettingsListGroup.Value>}
/>
```

### SettingsListGroup.Custom

행 모양이 아닌 내용을 직접 그리는 칸이에요. 행과 같은 여백으로 담아요. `children`, 줄 사이 `gap`(기본 12), `className`만 받아요.

### SettingsListGroup.Error

`QueryErrorBoundary`의 `fallback`으로 넘겨요. 제목·설명과 `QueryErrorActions`(다시 시도 + 문의하기)를 카드 안에 그려요.

### SettingsListGroup.Separator

행 사이 구분선이에요. 좌우 16 들여쓰기예요.

### SettingsScreenLayout

`ScrollView` props와 같아요. `gap`(기본 12)은 카드 사이 간격이에요. `SafeAreaScrollView` 위에 있어 스크롤바와 배경은 가장자리까지 두고 내용만 가로·아래 safe area를 피하며(공식 iPhone Duo 안내), 마이 탭 칸의 context inset을 따라요. `ReadableContent`로 넓은 화면의 폭을 모아요.
