# ListRow

리스트 아이템을 표현하는 Compound Component입니다. 왼쪽, 중앙, 오른쪽 영역으로 구성되며, 다양한 레이아웃과 스타일을 지원합니다.

## 구조

```
list-row/
├── list-row.tsx         # 메인 컴포넌트
├── list-row-texts.tsx   # 텍스트 서브 컴포넌트
├── list-row.md          # 이 문서
└── index.ts
```

## 기본 사용법

```tsx
import { ListRow } from '@src/shared/ui';

// 기본 사용
<ListRow
  contents={<ListRow.Texts type="1RowTypeA" top="제목" />}
/>

// 완전한 구성
<ListRow
  left={<UserAvatar alt="김용민" profileImage="avatar.jpg" />}
  contents={<ListRow.Texts type="2RowTypeA" top="김용민" bottom="시니어 개발자" />}
  right={<ArrowRightIcon />}
  horizontalPadding="medium"
/>
```

## API Reference

### ListRow (메인 컴포넌트)

#### Props

| Prop                | Type                                         | Default    | Description             |
| ------------------- | -------------------------------------------- | ---------- | ----------------------- |
| `left`              | `ReactNode`                                  | -          | 왼쪽 영역 컨텐츠        |
| `contents`          | `ReactNode`                                  | -          | 중앙 영역 컨텐츠 (필수) |
| `right`             | `ReactNode`                                  | -          | 오른쪽 영역 컨텐츠      |
| `onPress`           | `() => void`                                 | -          | 넘기면 행 전체가 버튼   |
| `verticalPadding`   | `'small' \| 'medium' \| 'large' \| 'xlarge'` | `'medium'` | 상하 패딩               |
| `horizontalPadding` | `'small' \| 'medium' \| 'none'`              | `'none'`   | 좌우 패딩               |
| `border`            | `'indented' \| 'none'`                       | `'none'`   | 하단 테두리             |
| `leftAlignment`     | `'top' \| 'center'`                          | `'center'` | 왼쪽 영역 정렬          |
| `rightAlignment`    | `'top' \| 'center'`                          | `'center'` | 오른쪽 영역 정렬        |
| `isDisabled`        | `boolean`                                    | `false`    | 비활성화 상태           |
| `className`         | `string`                                     | -          | 추가 클래스명           |

#### Vertical Padding 크기

- `small`: `py-1` (4px)
- `medium`: `py-2` (8px)
- `large`: `py-4` (16px)
- `xlarge`: `py-5` (20px)

#### Horizontal Padding 크기

- `none`: 패딩 없음
- `small`: `px-2` (8px)
- `medium`: `px-4` (16px)

### ListRow.Texts

텍스트 컨텐츠를 표시하는 서브 컴포넌트입니다. Discriminated Union 타입으로 각 타입별 필수 props가 강제됩니다.

#### Type: `1RowTypeA`

**1줄 레이아웃** - 제목만 표시

```tsx
<ListRow.Texts type="1RowTypeA" top="제목" topProps={{ size: 'b1', weight: 'bold' }} />
```

**Props:**

- `type`: `'1RowTypeA'` (필수)
- `top`: `ReactNode` (필수) - 제목 텍스트
- `topProps`: `Omit<TextProps, 'children'>` (선택) - 제목 스타일

**사용 예시:**

- 단순 메뉴 항목
- 설정 옵션
- 간단한 리스트 아이템

---

#### Type: `2RowTypeA`

**2줄 레이아웃** - 제목 + 하단 텍스트

```tsx
<ListRow.Texts
  type="2RowTypeA"
  top="김용민"
  topProps={{ size: 'b2', weight: 'bold' }}
  bottom="시니어 개발자"
  bottomProps={{ size: 'e1', shade: 5 }}
/>
```

**Props:**

- `type`: `'2RowTypeA'` (필수)
- `top`: `ReactNode` (필수) - 제목 텍스트
- `topProps`: `Omit<TextProps, 'children'>` (선택) - 제목 스타일
- `bottom`: `ReactNode` (필수) - 하단 텍스트
- `bottomProps`: `Omit<TextProps, 'children'>` (선택) - 하단 스타일

**사용 예시:**

- 사용자 프로필 (이름 + 직책)
- 파일 정보 (파일명 + 크기)
- 상품 정보 (상품명 + 가격)

---

#### Type: `3RowTypeA`

**3줄 레이아웃** - 제목 + 중간 텍스트 + 하단 텍스트

```tsx
<ListRow.Texts
  type="3RowTypeA"
  top="프로젝트 제목"
  topProps={{ size: 'b2', weight: 'bold' }}
  middle="진행 중 · 마감 3일 전"
  middleProps={{ size: 'b3', shade: 6 }}
  bottom="팀원 5명 참여 중"
  bottomProps={{ size: 'e1', shade: 5 }}
/>
```

**Props:**

- `type`: `'3RowTypeA'` (필수)
- `top`: `ReactNode` (필수) - 제목 텍스트
- `topProps`: `Omit<TextProps, 'children'>` (선택) - 제목 스타일
- `middle`: `ReactNode` (필수) - 중간 텍스트
- `middleProps`: `Omit<TextProps, 'children'>` (선택) - 중간 스타일
- `bottom`: `ReactNode` (필수) - 하단 텍스트
- `bottomProps`: `Omit<TextProps, 'children'>` (선택) - 하단 스타일

**사용 예시:**

- 프로젝트 카드 (제목 + 상태 + 참여자)
- 알림 아이템 (제목 + 내용 + 시간)
- 상세 정보 (제목 + 설명 + 추가정보)

---

### ListRow.Texts.Loading

`ListRow.Texts`와 같은 `VStack`·간격·기본 크기(b2/b3/e1)로 글자 자리를 `TextSkeleton`으로 채웁니다.
목록의 `.Loading`은 `ListRow`의 같은 슬롯에 이것을 넣어 행 높이를 실제 행과 맞춥니다.

```tsx
<ListRow
  left={<Skeleton className="size-10 rounded-full" />}
  contents={
    <ListRow.Texts.Loading type="2RowTypeA" bottomProps={{ size: 'b3', className: 'w-full' }} />
  }
/>
```

- `type`: `ListRow.Texts`와 같은 줄 구성
- `topProps` / `middleProps` / `bottomProps`: `TextSkeletonProps`(`size`, `className`) — 실제 행에서 바꾼 크기만 다시 준다

## 사용 예시

### 1. 기본 메뉴 아이템

```tsx
<ListRow
  contents={<ListRow.Texts type="1RowTypeA" top="설정" />}
  right={<ArrowRightIcon />}
  horizontalPadding="medium"
/>
```

### 2. 사용자 프로필

```tsx
<ListRow
  left={<UserAvatar alt="김용민" profileImage="https://example.com/avatar.jpg" />}
  contents={
    <ListRow.Texts
      type="2RowTypeA"
      top="김용민"
      topProps={{ weight: 'bold' }}
      bottom="시니어 개발자"
      bottomProps={{ shade: 6 }}
    />
  }
  right={<MoreIcon />}
  horizontalPadding="medium"
  verticalPadding="large"
/>
```

### 3. 프로젝트 카드

```tsx
<ListRow
  left={
    <FeatureMedia
      alt=""
      source={{ uri: 'https://example.com/project.jpg' }}
      ratio={1}
      className="w-16"
    />
  }
  contents={
    <ListRow.Texts
      type="3RowTypeA"
      top="AI 챗봇 개발"
      topProps={{ size: 'b1', weight: 'bold' }}
      middle="진행 중 · 마감 3일 전"
      middleProps={{ size: 'b3', shade: 6 }}
      bottom="팀원 5명 참여 중"
      bottomProps={{ size: 'e1', shade: 5 }}
    />
  }
  right={<Badge text="긴급" />}
  horizontalPadding="medium"
  verticalPadding="xlarge"
  border="indented"
/>
```

### 4. 파일 리스트

```tsx
<ListRow
  left={<FileIcon type="pdf" />}
  contents={
    <ListRow.Texts
      type="2RowTypeA"
      top="프로젝트_제안서.pdf"
      bottom="2.4 MB · 2024.01.20"
      bottomProps={{ shade: 6 }}
    />
  }
  right={<DownloadIcon />}
  horizontalPadding="medium"
/>
```

### 5. 비활성화 상태

```tsx
<ListRow
  contents={<ListRow.Texts type="1RowTypeA" top="준비 중인 기능" />}
  isDisabled
  horizontalPadding="medium"
/>
```

## 스타일링

### Padding 조합

```tsx
// 작은 패딩
<ListRow
  verticalPadding="small"
  horizontalPadding="small"
/>

// 중간 패딩 (기본)
<ListRow
  verticalPadding="medium"
  horizontalPadding="medium"
/>

// 큰 패딩
<ListRow
  verticalPadding="xlarge"
  horizontalPadding="medium"
/>
```

### Border 스타일

```tsx
// 하단 테두리 (들여쓰기)
<ListRow border="indented" horizontalPadding="medium" />
```

### Alignment

```tsx
// 왼쪽 영역 상단 정렬
<ListRow
  left={<LargeIcon />}
  leftAlignment="top"
  contents={<ListRow.Texts type="3RowTypeA" ... />}
/>

// 오른쪽 영역 상단 정렬
<ListRow
  contents={<ListRow.Texts type="2RowTypeA" ... />}
  right={<Badge />}
  rightAlignment="top"
/>
```

## 타입 안정성

ListRow.Texts는 **Discriminated Union** 타입을 사용하여 각 타입별로 필수 props를 강제합니다.

```typescript
// ✅ 올바른 사용
<ListRow.Texts
  type="2RowTypeA"
  top="제목"
  bottom="부제목"  // type이 '2RowTypeA'이므로 bottom 필수!
/>

// ❌ 컴파일 에러
<ListRow.Texts
  type="2RowTypeA"
  top="제목"
  // Error: Property 'bottom' is missing
/>

// ✅ 올바른 사용
<ListRow.Texts
  type="3RowTypeA"
  top="제목"
  middle="설명"    // 필수
  bottom="추가정보" // 필수
/>
```

## 접근성

- 모든 텍스트는 기본적으로 읽기 가능
- 이미지에는 적절한 `accessibilityLabel` 제공 권장
- 누르는 행은 `onPress`를 넘긴다. 행 전체가 `button` 역할의 버튼이 된다

```tsx
<ListRow
  contents={<ListRow.Texts type="1RowTypeA" top="설정" />}
  right={<ArrowRightIcon />}
  onPress={handlePress}
/>
```

## 성능 최적화

- 큰 리스트에서는 `React.memo` 사용 권장
- 이미지는 적절한 크기로 최적화하여 사용

```tsx
const MemoizedListRow = React.memo(({ item }) => (
  <ListRow
    left={<UserAvatar alt={item.name} profileImage={item.avatar} />}
    contents={<ListRow.Texts type="2RowTypeA" top={item.name} bottom={item.role} />}
  />
));
```

## 누르는 행

토스 `ListRow`의 `onClick`과 같은 역할로 `onPress`를 받는다. 넘기면 행 전체가 버튼이 된다.

```tsx
<ListRow contents={<ListRow.Texts type="1RowTypeA" top="계정" />} onPress={openAccount} />
```

`contents`는 필수다. 패딩은 `withPadding` 대신 `verticalPadding`, `horizontalPadding`으로 정한다.
