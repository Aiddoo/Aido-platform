# Meter

쓴 양을 가로 막대로 보여 준다. 하위 할 일 진행(`TodoRow.Progress`)과 남은 AI 횟수(마이·프리미엄 안내 시트)가 쓴다.
숫자 글자는 쓰는 쪽이 옆에 둔다. 막대는 값만 그린다.

## 사용법

```tsx
import { Meter } from '@src/shared/ui';

<Meter value={used} max={limit} className="w-10" />
<Meter value={used} max={limit} size="medium" />
```

채운 부분은 늘 브랜드 색(`bg-main`)이다.

## Props

| Prop                                                   | 타입                   | 기본값      | 설명                                                     |
| ------------------------------------------------------ | ---------------------- | ----------- | -------------------------------------------------------- |
| value                                                  | `number`               | -           | 쓴 양. `max`를 넘으면 가득 찬 막대다                     |
| max                                                    | `number`               | -           | 최댓값. 0이면 빈 막대다                                  |
| size                                                   | `'small' \| 'medium'`  | `'small'`   | 막대 두께(4·8)                                           |
| tone                                                   | `'surface' \| 'onSky'` | `'surface'` | 바탕. 날씨 하늘처럼 늘 어두운 면 위에서는 `onSky`        |
| className                                              | `string`               | -           | 폭·여백 등 배치만 정한다. 폭을 주지 않으면 부모를 채운다 |
| accessibilityElementsHidden, importantForAccessibility | `ViewProps`            | -           | 옆 글자가 같은 숫자를 읽을 때 막대를 숨긴다              |

접근성 역할은 `progressbar`이고 `accessibilityValue`로 값을 읽어 준다. 옆 글자가 같은 숫자를 읽으면
`accessibilityElementsHidden`·`importantForAccessibility="no-hide-descendants"`로 막대를 숨긴다.

## 파일 구조

```
meter/
├── meter.tsx
├── meter.md
├── meter.test.tsx
└── index.ts
```
