# IconRadioItem

`RadioGroup` 안에서 쓰는 라디오 행. 라벨, 선택적 설명, 선택적 아이콘 인디케이터를 보여준다.
원본 `RadioGroup.Item` props(`value`, `isDisabled` 등)를 그대로 받는다.

## 사용법

```tsx
import { IconRadioItem } from '@src/shared/ui';
import { RadioGroup } from 'heroui-native';

<RadioGroup value={mode} onValueChange={setMode}>
  <IconRadioItem value="light" label="라이트" Icon={SunIcon} />
  <IconRadioItem value="dark" label="다크" Icon={MoonIcon} />
  <IconRadioItem value="plain" label="아이콘 없음" description="설명" />
</RadioGroup>;
```

## Props

| Prop          | 타입                                                       | 기본값 | 설명                                        |
| ------------- | ---------------------------------------------------------- | ------ | ------------------------------------------- |
| `value`       | `string`                                                   | -      | 라디오 값 (`RadioGroup.Item`)               |
| `label`       | `string`                                                   | -      | 행 제목                                     |
| `Icon`        | `StyledIconType`                                           | -      | 선택 시 인디케이터에 나타나는 아이콘 (선택) |
| `description` | `string`                                                   | -      | 보조 설명 (선택)                            |
| 그 외         | `Omit<ComponentProps<typeof RadioGroup.Item>, 'children'>` | -      | `isDisabled` 등 원본 props                  |

## 파일 구조

```
icon-radio-item/
├── icon-radio-item.tsx
├── icon-radio-item.md
└── index.ts
```
