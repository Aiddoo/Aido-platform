# ReadableContent 컴포넌트

넓은 창에서 폼·안내 내용을 가운데 최대 폭(`READABLE_CONTENT_MAX_WIDTH`, 480)으로 모으는 컨테이너입니다. UIKit `readableContentGuide`와 같은 역할입니다.

```tsx
import { ReadableContent } from '@src/shared/ui';
```

## 동작

- `w-full self-center` + `maxWidth: 480`. 창이 480보다 좁은 일반 폰에서는 창 폭을 그대로 쓰므로 레이아웃이 바뀌지 않는다.
- iPhone Duo 내부 화면, 폴더블 펼침, 태블릿에서는 버튼·입력이 창 끝까지 늘어나지 않고 가운데에 모인다.
- 배경은 부모가 창 전체에 깐다. Apple HIG의 "배경은 전체 폭, 내용은 안쪽" 원칙을 따른다.
- 2-pane 화면의 pane 안에는 쓰지 않는다. pane 폭은 `AdaptivePane`이 정한다.

## Props

`Box`와 같다(`flex`, `px`, `gap`, `className`, `style` 등). `style`은 최대 폭 뒤에 합쳐진다.

## 파일 구조

```
readable-content/
├── readable-content.tsx
├── readable-content.types.ts
├── readable-content.test.tsx
├── index.ts
└── readable-content.md
```
