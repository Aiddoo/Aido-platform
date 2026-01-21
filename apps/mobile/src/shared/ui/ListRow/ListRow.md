# ListRow

리스트 형태의 행 아이템을 구성하는 컴포넌트입니다. 왼쪽/중앙/오른쪽 영역으로 구성됩니다.

## 사용법

```tsx
import { ListRow } from '@src/shared/ui/ListRow/ListRow';

// 기본 사용 - 텍스트만
<ListRow contents={<ListRow.Texts top="제목" />} />

// 아이콘 + 텍스트 + 화살표
<ListRow
  left={<ListRow.Icon><UserIcon /></ListRow.Icon>}
  contents={<ListRow.Texts top="프로필" />}
  right={<ArrowRightIcon />}
/>

// 2줄 텍스트
<ListRow
  contents={<ListRow.Texts type="2Row" top="홍길동" middle="친구 10명" />}
/>
```

## Props

| Prop | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `left` | `ReactNode` | - | 왼쪽 영역 (아이콘 등) |
| `contents` | `ReactNode` | - | 중앙 콘텐츠 영역 |
| `right` | `ReactNode` | - | 오른쪽 영역 (화살표 등) |
| `verticalPadding` | `'small' \| 'medium' \| 'large' \| 'xlarge'` | `'medium'` | 세로 패딩 |
| `horizontalPadding` | `'small' \| 'medium' \| 'none'` | `'none'` | 가로 패딩 |
| `border` | `'indented' \| 'none'` | `'none'` | 하단 테두리 |
| `leftAlignment` | `'top' \| 'center'` | `'center'` | 왼쪽 영역 세로 정렬 |
| `rightAlignment` | `'top' \| 'center'` | `'center'` | 오른쪽 영역 세로 정렬 |
| `disabled` | `boolean` | `false` | 비활성화 상태 |
| `className` | `string` | - | 추가 스타일 |

## 세로 패딩 (verticalPadding)

| Value | CSS |
|-------|-----|
| `small` | py-1 (4px) |
| `medium` | py-2 (8px) |
| `large` | py-4 (16px) |
| `xlarge` | py-5 (20px) |

```tsx
<ListRow verticalPadding="small" contents={<ListRow.Texts top="Small" />} />
<ListRow verticalPadding="medium" contents={<ListRow.Texts top="Medium" />} />
<ListRow verticalPadding="large" contents={<ListRow.Texts top="Large" />} />
<ListRow verticalPadding="xlarge" contents={<ListRow.Texts top="XLarge" />} />
```

## 가로 패딩 (horizontalPadding)

| Value | CSS |
|-------|-----|
| `none` | 없음 |
| `small` | px-2 (8px) |
| `medium` | px-4 (16px) |

```tsx
<ListRow horizontalPadding="small" contents={<ListRow.Texts top="With Padding" />} />
```

## 하단 테두리 (border)

```tsx
// 테두리 없음 (기본)
<ListRow border="none" contents={<ListRow.Texts top="No Border" />} />

// 들여쓰기 테두리
<ListRow border="indented" contents={<ListRow.Texts top="With Border" />} />
```

## Sub-components

### ListRow.Texts

텍스트 콘텐츠를 구성합니다. `type`에 따라 1~3줄을 표시합니다.

#### Props

| Prop | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `type` | `'1Row' \| '2Row' \| '3Row' \| 'Right1Row' \| 'Right2Row' \| 'Right3Row'` | `'1Row'` | 텍스트 타입 |
| `top` | `ReactNode` | - | 첫 번째 줄 (필수) |
| `topProps` | `TextProps` | - | top 텍스트 추가 props |
| `middle` | `ReactNode` | - | 두 번째 줄 (2Row, 3Row에서 표시) |
| `middleProps` | `TextProps` | - | middle 텍스트 추가 props |
| `bottom` | `ReactNode` | - | 세 번째 줄 (3Row에서만 표시) |
| `bottomProps` | `TextProps` | - | bottom 텍스트 추가 props |

#### 타입별 스타일

| Type | 설명 | 정렬 |
|------|------|------|
| `1Row` | 1줄 (top만) | 왼쪽 |
| `2Row` | 2줄 (top + middle) | 왼쪽 |
| `3Row` | 3줄 (top + middle + bottom) | 왼쪽 |
| `Right1Row` | 1줄 | 오른쪽 |
| `Right2Row` | 2줄 | 오른쪽 |
| `Right3Row` | 3줄 | 오른쪽 |

```tsx
// 1줄
<ListRow.Texts type="1Row" top="제목" />

// 2줄
<ListRow.Texts type="2Row" top="제목" middle="설명" />

// 3줄
<ListRow.Texts type="3Row" top="제목" middle="설명" bottom="추가 정보" />

// 오른쪽 정렬
<ListRow.Texts type="Right2Row" top="10,000원" middle="배송비 포함" />
```

### ListRow.Icon

아이콘을 감싸는 컨테이너입니다.

#### Props

| Prop | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `children` | `ReactNode` | - | 아이콘 컴포넌트 |
| `size` | `'small' \| 'medium' \| 'large'` | `'small'` | 아이콘 컨테이너 크기 |
| `className` | `string` | - | 추가 스타일 |

#### 크기

| Size | CSS |
|------|-----|
| `small` | w-6 h-6 (24px) |
| `medium` | w-10 h-10 (40px) |
| `large` | w-12 h-12 (48px) |

```tsx
<ListRow.Icon size="small"><SmallIcon /></ListRow.Icon>
<ListRow.Icon size="medium"><MediumIcon /></ListRow.Icon>
<ListRow.Icon size="large"><LargeIcon /></ListRow.Icon>
```

## 사용 예시

### 메뉴 아이템

```tsx
<PressableFeedback onPress={handlePress}>
  <ListRow
    contents={<ListRow.Texts top="친구 관리" />}
    right={<ArrowRightIcon width={16} height={16} color={gray6} />}
    verticalPadding="large"
  />
</PressableFeedback>
```

### 프로필 아이템

```tsx
<ListRow
  left={
    <ListRow.Icon size="large">
      <Avatar size="md">
        <Avatar.Image source={{ uri: profileImage }} />
      </Avatar>
    </ListRow.Icon>
  }
  contents={<ListRow.Texts type="2Row" top="홍길동" middle="친구 10명" />}
  right={<ArrowRightIcon />}
  verticalPadding="medium"
/>
```

### 설정 아이템 (상단 정렬)

```tsx
<ListRow
  left={<ListRow.Icon><SettingsIcon /></ListRow.Icon>}
  contents={
    <ListRow.Texts
      type="2Row"
      top="알림 설정"
      middle="푸시 알림, 이메일 알림 등을 설정합니다"
    />
  }
  right={<Switch />}
  leftAlignment="top"
  rightAlignment="top"
/>
```

### 테두리가 있는 리스트

```tsx
<VStack>
  <ListRow border="indented" contents={<ListRow.Texts top="항목 1" />} />
  <ListRow border="indented" contents={<ListRow.Texts top="항목 2" />} />
  <ListRow contents={<ListRow.Texts top="항목 3" />} />
</VStack>
```
