# Text 컴포넌트

타이포그래피를 위한 기본 텍스트 컴포넌트입니다.

## 설치

이 컴포넌트는 `@aido/mobile` 앱에 포함되어 있습니다.

```tsx
import { Text, H1, H2, H3, H4 } from './core/component/ui/Text';
```

## 기본 사용법

```tsx
<Text>기본 텍스트</Text>
```

## Props

| Prop | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `tone` | `'neutral' \| 'brand' \| 'danger' \| 'warning' \| 'success' \| 'info'` | `'neutral'` | 시맨틱 색상 |
| `shade` | `1 \| 2 \| 3 \| ... \| 10` | - | 회색 명도 (tone="neutral"일 때만 적용) |
| `size` | `'h1' \| 't1' \| 't2' \| 't3' \| 'b1' \| 'b2' \| 'b3' \| 'b4' \| 'e1' \| 'e2'` | `'b3'` | 텍스트 크기 |
| `weight` | `'normal' \| 'medium' \| 'semibold' \| 'bold'` | `'normal'` | 폰트 굵기 |
| `align` | `'left' \| 'center' \| 'right'` | `'left'` | 텍스트 정렬 |
| `maxLines` | `number` | - | 최대 줄 수 (numberOfLines) |
| `strikethrough` | `boolean` | `false` | 취소선 |
| `underline` | `boolean` | `false` | 밑줄 |
| `className` | `string` | - | 추가 Tailwind 클래스 |

## 크기 (size)

| 사이즈 | 픽셀 | 용도 |
|--------|------|------|
| `h1` | 30px | 대제목 |
| `t1` | 28px | Title 1 |
| `t2` | 22px | Title 2 |
| `t3` | 20px | Title 3 |
| `b1` | 17px | Body 1 |
| `b2` | 16px | Body 2 |
| `b3` | 15px | Body 3 (기본값) |
| `b4` | 13px | Body 4 |
| `e1` | 12px | Extra 1 (캡션) |
| `e2` | 11px | Extra 2 (가장 작음) |

## 색상 시스템 (tone + shade)

### Tone (시맨틱 색상)

```tsx
<Text tone="neutral">기본 텍스트</Text>
<Text tone="brand">브랜드 색상</Text>
<Text tone="danger">에러/위험</Text>
<Text tone="warning">경고</Text>
<Text tone="success">성공</Text>
<Text tone="info">정보</Text>
```

### Shade (회색 명도)

`tone="neutral"`일 때만 적용됩니다. 1(가장 연함)부터 10(가장 진함)까지 사용할 수 있습니다.

```tsx
<Text tone="neutral" shade={10}>가장 진한 텍스트</Text>
<Text tone="neutral" shade={8}>기본 텍스트</Text>
<Text tone="neutral" shade={6}>보조 텍스트</Text>
<Text tone="neutral" shade={4}>비활성 텍스트</Text>
```

**주의**: `tone`이 `neutral`이 아닌 경우 `shade`는 무시됩니다.

```tsx
// shade가 무시됨 - brand 색상만 적용
<Text tone="brand" shade={8}>브랜드 색상</Text>
```

## Heading 컴포넌트

`H1`, `H2`, `H3`, `H4`는 시맨틱 Heading 컴포넌트입니다. 자동으로 `accessibilityRole="header"`가 설정됩니다.

```tsx
<H1>대제목</H1>
<H2>중제목</H2>
<H3>소제목</H3>
<H4>부제목</H4>
```

### emphasize

브랜드 색상으로 강조합니다.

```tsx
<H1 emphasize>강조된 제목</H1>
```

### headline (H1 전용)

상단에 작은 라벨을 추가합니다.

```tsx
<H1 headline="STEP 1">회원가입</H1>
// 결과:
// STEP 1  (작은 브랜드 색상 라벨)
// 회원가입 (큰 제목)
```

## 스타일 조합 예시

```tsx
// 기본 본문
<Text>일반 텍스트입니다.</Text>

// 굵은 브랜드 색상
<Text tone="brand" weight="bold" size="t2">
  중요한 안내
</Text>

// 연한 회색 캡션
<Text tone="neutral" shade={6} size="e1">
  2024년 1월 18일
</Text>

// 에러 메시지
<Text tone="danger" size="b4">
  비밀번호가 일치하지 않습니다.
</Text>

// 취소선이 있는 텍스트
<Text strikethrough tone="neutral" shade={6}>
  ₩50,000
</Text>

// 최대 2줄로 제한
<Text maxLines={2}>
  긴 텍스트가 2줄을 넘으면 말줄임표로 표시됩니다...
</Text>
```

## className으로 추가 스타일링

```tsx
<Text className="mt-4 px-2">추가 마진과 패딩</Text>
```
