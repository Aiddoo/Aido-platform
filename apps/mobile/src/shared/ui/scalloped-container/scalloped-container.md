# ScallopedContainer

위아래 가장자리를 물결(가리비) 모양으로 자른 흰 카드 컨테이너다. 영수증처럼 보이는 AI 리포트·제안,
구독 혜택 카드에 쓴다. 배경은 `bg-white` 테마 토큰을 따르므로 다크 모드에서도 함께 바뀐다.

## 사용법

```tsx
import { ScallopedContainer } from '@src/shared/ui';

<ScallopedContainer>
  <View className="px-4 py-5">{content}</View>
</ScallopedContainer>;
```

## Props

| Prop       | 타입        | 설명                                    |
| ---------- | ----------- | --------------------------------------- |
| `children` | `ReactNode` | 카드 안 내용. 여백은 사용처에서 정한다. |

## 파일 구조

```
scalloped-container/
├── scalloped-container.tsx
├── scalloped-container.md
└── index.ts
```
