# ActionChip

선택 가능한 액션 칩 컴포넌트. 아이콘 + 라벨 조합으로 필터/옵션 선택에 사용.

## 사용법

```tsx
import { ActionChip, ACTION_CHIP_ICON_SIZE } from '@src/shared/ui';
import { CalendarIcon } from '@src/shared/ui';

<ActionChip
  icon={<CalendarIcon width={ACTION_CHIP_ICON_SIZE} height={ACTION_CHIP_ICON_SIZE} colorClassName="text-main" />}
  label="오늘"
  isActive
  onPress={() => {}}
/>
```

## Props

| Prop | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `icon` | `ReactNode` | - | 좌측 아이콘 |
| `label` | `string` | - | 칩 라벨 텍스트 |
| `isActive` | `boolean` | `false` | 활성 상태 (브랜드 색상 적용) |
| `onPress` | `() => void` | - | 클릭 핸들러 |

### 스타일

- `isActive=true`: `border-main/30 bg-main/10`, 텍스트 `tone="brand"`
- `isActive=false`: `border-gray-3`, 텍스트 `shade={6}`
- 공통: `h-8`, `rounded-full`, `gap-1.5`, `px-3`

### 상수

- `ACTION_CHIP_ICON_SIZE`: 아이콘 권장 크기 (`fontScaledSize(16, 0.3)`)

## 파일 구조

```
ActionChip/
├── ActionChip.tsx   # 컴포넌트 구현
├── ActionChip.md    # 문서
└── index.ts         # export
```
