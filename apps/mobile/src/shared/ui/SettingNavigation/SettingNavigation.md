# SettingNavigation

설정 화면에서 사용하는 섹션 그룹 + 네비게이션 아이템 Compound Component.

## 사용법

```tsx
import { SettingNavigation } from '@src/shared/ui';

<SettingNavigation>
  <SettingNavigation.Item label="알림 설정" onPress={() => router.push('/settings/notifications')} />
  <SettingNavigation.Item label="화면 테마" onPress={() => router.push('/settings/theme')} />
</SettingNavigation>
```

### 커스텀 right 영역

```tsx
<SettingNavigation.Item
  label="이름 변경"
  onPress={() => router.push('/settings/edit-name')}
  right={
    <HStack align="center" gap={4}>
      <Text size="b2" shade={6}>{user.name}</Text>
      <ArrowRightIcon colorClassName="text-gray-6" />
    </HStack>
  }
/>
```

## Props

### SettingNavigation

| Prop | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `children` | `ReactNode` | - | 내부 `SettingNavigation.Item` 목록 |

### SettingNavigation.Item

| Prop | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `label` | `string` | - | 항목 텍스트 |
| `onPress` | `() => void` | - | 클릭 핸들러 |
| `right` | `ReactNode` | `<ArrowRightIcon />` | 우측 영역 커스텀 |

## 파일 구조

```
SettingNavigation/
├── SettingNavigation.tsx   # 컴포넌트 구현
├── SettingNavigation.md    # 문서
└── index.ts                # barrel export
```
