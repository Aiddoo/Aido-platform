# ActionButton

선택 가능한 액션 칩 컴포넌트. 아이콘 + 라벨 조합으로 필터/옵션 선택에 사용.

## 사용법

```tsx
import { ActionButton, CalendarIcon } from '@src/shared/ui';

<ActionButton
  icon={<ActionButton.Icon Icon={CalendarIcon} colorClassName="text-main" />}
  label="오늘"
  isActive
  onPress={() => {}}
/>;
```

## Props

| Prop       | 타입         | 기본값  | 설명                         |
| ---------- | ------------ | ------- | ---------------------------- |
| `icon`     | `ReactNode`  | -       | 좌측 아이콘                  |
| `label`    | `string`     | -       | 칩 라벨 텍스트               |
| `isActive` | `boolean`    | `false` | 활성 상태 (브랜드 색상 적용) |
| `onPress`  | `() => void` | -       | 클릭 핸들러                  |

### 스타일

- `isActive=true`: `border-main/30 bg-main/10`, 텍스트 `tone="brand"`
- `isActive=false`: `border-gray-3`, 텍스트 `shade={6}`
- 공통: `h-8`, `rounded-full`, `gap-1.5`, `px-3`

### 아이콘

- `ActionButton.Icon`: 글꼴 배율에 맞춘 칩 아이콘 크기(`fontScaledSize(16, 0.3)`)를 칩이 정한다. 아이콘이 아닌 표시(카테고리 색 점)는 `icon`에 바로 넘긴다.

## heroui `Chip`으로 옮기지 않은 이유

heroui `Chip`은 `Pressable`이라 눌림 크기 변화가 없고 role도 없다. `ActionButton`은 `PressableFeedback` 위에서 눌림, 고정 높이 32, role `button`을 함께 갖는다.
