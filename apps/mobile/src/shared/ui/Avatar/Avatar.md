# Avatar

HeroUI Native Avatar를 확장한 공용 아바타 컴포넌트. `isSelected` prop으로 선택 상태(border + 체크 배지)를 표현한다.

## 사용법

```tsx
import { Avatar } from '@src/shared/ui/Avatar/Avatar';

// 기본 사용 (선택 UI 없음)
<Avatar size="lg" alt="프로필">
  <Avatar.Image source={require('@assets/icon.png')} />
</Avatar>

// 선택 가능 모드
<Avatar isSelected={isSelected} className="w-20 h-20 rounded-2xl">
  <Avatar.Image source={icon.preview} />
</Avatar>
```

### 선택 그리드 패턴

```tsx
import { Avatar } from '@src/shared/ui/Avatar/Avatar';
import { PressableFeedback } from 'heroui-native';

<PressableFeedback onPress={handleSelect} className="rounded-2xl overflow-visible">
  <VStack align="center" gap={8} py={8} className="overflow-visible">
    <Avatar isSelected={selected} className="w-20 h-20 rounded-2xl">
      <Avatar.Image source={icon.preview} />
    </Avatar>
    <Text size="b4" weight={selected ? 'semibold' : 'normal'}>
      {icon.label}
    </Text>
  </VStack>
  <PressableFeedback.Highlight className="rounded-2xl" />
</PressableFeedback>
```

### Loading 상태

```tsx
<Avatar.Loading />
```

## Props

### Avatar

HeroUI `AvatarRootProps`의 모든 props를 상속한다 (`size`, `variant`, `color`, `className`, `alt` 등).

| Prop | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `isSelected` | `boolean \| undefined` | `undefined` | 선택 상태. `undefined`이면 선택 UI 없음 |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | 아바타 크기 (HeroUI 상속) |
| `className` | `string` | - | 추가 스타일 (HeroUI 상속) |

### isSelected 동작

| 값 | border | 체크 배지 | 용도 |
|----|--------|----------|------|
| `undefined` | 없음 | 없음 | 비선택 컨텍스트 (ProfileCard 등) |
| `false` | gray border | 없음 | 선택 가능하지만 미선택 |
| `true` | main border | 표시 | 선택됨 |

### Sub-components

| 컴포넌트 | 설명 |
|----------|------|
| `Avatar.Image` | HeroUI Avatar.Image 포워딩 |
| `Avatar.Fallback` | HeroUI Avatar.Fallback 포워딩 |
| `Avatar.Loading` | Skeleton 로딩 상태 |

## 파일 구조

```
src/shared/ui/Avatar/
├── Avatar.tsx   # 메인 컴포넌트 + Loading + SelectedBadge
└── Avatar.md    # 문서
```
