# ListRow

리스트 아이템을 표현하는 Compound Component입니다. 왼쪽, 중앙, 오른쪽 영역으로 구성되며, 다양한 레이아웃과 스타일을 지원합니다.

## 구조

```
ListRow/
├── ListRow.tsx          # 메인 컴포넌트
├── ListRowTexts.tsx     # 텍스트 서브 컴포넌트
├── ListRowImage.tsx     # 이미지 서브 컴포넌트
└── ListRow.test.tsx     # 테스트
```

## 기본 사용법

```tsx
import { ListRow } from '@src/shared/ui/ListRow/ListRow';

// 기본 사용
<ListRow
  contents={<ListRow.Texts type="1RowTypeA" top="제목" />}
/>

// 완전한 구성
<ListRow
  left={<ListRow.Image source={{ uri: 'avatar.jpg' }} />}
  contents={<ListRow.Texts type="2RowTypeA" top="김용민" bottom="시니어 개발자" />}
  right={<ArrowRightIcon />}
  horizontalPadding="medium"
/>
```

## API Reference

### ListRow (메인 컴포넌트)

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `left` | `ReactNode` | - | 왼쪽 영역 컨텐츠 |
| `contents` | `ReactNode` | - | 중앙 영역 컨텐츠 (필수) |
| `right` | `ReactNode` | - | 오른쪽 영역 컨텐츠 |
| `verticalPadding` | `'small' \| 'medium' \| 'large' \| 'xlarge'` | `'medium'` | 상하 패딩 |
| `horizontalPadding` | `'small' \| 'medium' \| 'none'` | `'none'` | 좌우 패딩 |
| `border` | `'indented' \| 'none'` | `'none'` | 하단 테두리 |
| `leftAlignment` | `'top' \| 'center'` | `'center'` | 왼쪽 영역 정렬 |
| `rightAlignment` | `'top' \| 'center'` | `'center'` | 오른쪽 영역 정렬 |
| `disabled` | `boolean` | `false` | 비활성화 상태 |
| `className` | `string` | - | 추가 클래스명 |

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
<ListRow.Texts
  type="1RowTypeA"
  top="제목"
  topProps={{ size: 'b1', weight: 'bold' }}
/>
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

### ListRow.Image

이미지를 표시하는 서브 컴포넌트입니다. React Native의 `ImageProps`를 확장합니다.

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `source` | `ImageSourcePropType` | - | 이미지 소스 (필수) |
| `size` | `'small' \| 'medium' \| 'large'` | `'medium'` | 이미지 크기 |
| `rounded` | `boolean` | `true` | 둥근 모서리 적용 여부 |

#### Size 크기

- `small`: 32x32px
- `medium`: 48x48px
- `large`: 64x64px

#### 사용 예시

```tsx
// 기본 사용
<ListRow.Image source={{ uri: 'https://example.com/avatar.jpg' }} />

// 크기 지정
<ListRow.Image
  source={{ uri: 'https://example.com/avatar.jpg' }}
  size="large"
/>

// 둥근 모서리 제거
<ListRow.Image
  source={{ uri: 'https://example.com/avatar.jpg' }}
  rounded={false}
/>

// 로컬 이미지
<ListRow.Image source={require('@assets/images/avatar.png')} />
```

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
  left={
    <ListRow.Image
      source={{ uri: 'https://example.com/avatar.jpg' }}
      size="medium"
    />
  }
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
    <ListRow.Image
      source={{ uri: 'https://example.com/project.jpg' }}
      size="large"
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
  disabled={true}
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
<ListRow
  border="indented"
  horizontalPadding="medium"
/>
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
- 클릭 가능한 항목은 `onPress` 핸들러 추가

```tsx
<Pressable onPress={handlePress}>
  <ListRow
    contents={<ListRow.Texts type="1RowTypeA" top="설정" />}
    right={<ArrowRightIcon />}
  />
</Pressable>
```

## 성능 최적화

- `ListRow.Image`는 `resizeMode="cover"` 기본 적용
- 큰 리스트에서는 `React.memo` 사용 권장
- 이미지는 적절한 크기로 최적화하여 사용

```tsx
const MemoizedListRow = React.memo(({ item }) => (
  <ListRow
    left={<ListRow.Image source={{ uri: item.avatar }} />}
    contents={<ListRow.Texts type="2RowTypeA" top={item.name} bottom={item.role} />}
  />
));
```

## 테스트

Given-When-Then 패턴으로 작성된 테스트 코드를 참고하세요.

```tsx
it('should render contents when provided', () => {
  // Given: ListRow에 contents가 주어졌을 때
  const contentsText = '제목';

  // When: ListRow를 렌더링하면
  render(<ListRow contents={<ListRow.Texts type="1RowTypeA" top={contentsText} />} />);

  // Then: contents가 화면에 표시된다
  expect(screen.getByText(contentsText)).toBeTruthy();
});
```

## 마이그레이션 가이드

### Icon 제거

```tsx
// Before
<ListRow
  right={
    <ListRow.Icon>
      <ArrowRightIcon />
    </ListRow.Icon>
  }
/>

// After
<ListRow
  right={<ArrowRightIcon />}
/>
```

### Import 경로

```tsx
// Before
import { ListRow } from '@src/shared/ui/ListRow';

// After
import { ListRow } from '@src/shared/ui/ListRow/ListRow';
```
