# Result

상태 결과를 표시하는 전체 화면 컴포넌트입니다. 에러, 빈 상태 등 다양한 결과 화면에 사용합니다.

## 사용법

```tsx
import { Result } from '@src/shared/ui/Result/Result';

// 기본 사용
<Result
  title="다시 접속해주세요"
  description={`페이지를 불러올 수 없습니다\n다시 시도해주세요`}
  button={<Result.Button onPress={handleRetry}>재시도</Result.Button>}
/>

// 아이콘 포함
<Result
  icon={<CustomIcon />}
  title="검색 결과가 없어요"
  description="다른 검색어로 시도해보세요"
/>

// 버튼 없이
<Result
  title="준비 중입니다"
  description="곧 만나요!"
/>
```

## Props

| Prop | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `icon` | `ReactNode` | - | 상단 아이콘 |
| `title` | `string` | - | 제목 (필수) |
| `description` | `string` | - | 설명 (줄바꿈 `\n` 지원) |
| `button` | `ReactNode` | - | 하단 버튼 (`Result.Button` 사용) |
| `className` | `string` | - | 추가 스타일 |

## Result.Button

Result 내부에서 사용하는 버튼 서브컴포넌트입니다.

```tsx
<Result.Button onPress={handlePress}>버튼 텍스트</Result.Button>

// 색상 변경
<Result.Button color="primary" onPress={handlePress}>확인</Result.Button>
```

### Props

| Prop | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `children` | `ReactNode` | - | 버튼 내용 |
| `color` | `'primary' \| 'danger' \| 'dark'` | `'dark'` | 버튼 색상 |
| `onPress` | `() => void` | - | 클릭 핸들러 |
| `...rest` | `ButtonProps` | - | Button 컴포넌트의 나머지 props |

## 레이아웃

```
┌─────────────────────────────┐
│                             │
│         [아이콘]            │
│                             │
│     다시 접속해주세요        │  ← title
│                             │
│   페이지를 불러올 수 없습니다  │  ← description
│   다시 시도해주세요          │
│                             │
│       [ 재시도 ]            │  ← button
│                             │
└─────────────────────────────┘
```

## 접근성

- 아이콘은 장식용으로 처리됨 (`accessible={false}`)
- 스크린 리더는 title과 description만 읽음

