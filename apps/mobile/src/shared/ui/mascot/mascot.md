# Mascot

아이두 고양이 이미지를 그린다. 이미지 파일과 가운데 맞춤 계산을 여기서 맡아 호출부가 이미지를 직접 import하지 않는다.

## 사용법

```tsx
<Mascot name="catHi" size={120} isCentered />
<Mascot name="catSuggestion" size={72} className="mt-2" />
```

## Props

| prop         | 타입                         | 설명                                                  |
| ------------ | ---------------------------- | ----------------------------------------------------- |
| `name`       | `'catHi' \| 'catSuggestion'` | 인사 / 제안 고양이                                    |
| `size`       | `number`                     | 가로·세로. 없으면 `style`·`className`이 크기를 정한다 |
| `isCentered` | `boolean`                    | `size`가 있을 때 몸통을 캔버스 가운데로 옮긴다        |

`Image`에서 `source`를 뺀 나머지는 `...props`다(`contentFit` 기본 `contain`).

## 동작

- `catHi`는 든 손 때문에 몸통이 캔버스 오른쪽(554/1024)에 치우쳐, `isCentered`면 그만큼 왼쪽으로 옮긴다. `catSuggestion`은 옮기지 않는다.
- `accessibilityIgnoresInvertColors`가 켜져 있다.
