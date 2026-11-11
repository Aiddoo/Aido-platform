# WordWrapText

한글이 음절 사이에서 끊기지 않게 그리는 긴 글이다. Android에는 단어 단위 줄바꿈 Text prop이 없어(RN이 `LineBreakConfig`를 노출하지 않는다) 단어마다 따로 그리고, iOS는 `lineBreakStrategyIOS="hangul-word"`를 쓰는 `Text` 하나로 그린다.

## 사용법

```tsx
<WordWrapText size="b3" className="shrink flex-1">{keyPoint.text}</WordWrapText>

<WordWrapText size="b3">
  {[{ text: '오늘 ' }, { text: '치과', isUnderlined: true }, { text: '에 가요' }]}
</WordWrapText>
```

## Props

`Text`의 props를 그대로 받는다. `lineBreakStrategyIOS`, `numberOfLines`는 받지 않는다.

| Prop      | 타입                           | 설명                                                       |
| --------- | ------------------------------ | ---------------------------------------------------------- |
| children  | `string \| readonly TextRun[]` | 글. `TextRun`은 `text`, 선택 `isUnderlined`, 선택 `testID` |
| className | `string`                       | 바깥 표면(`shrink flex-1` 등)에 쓴다                       |

## 언제 쓰나

- 긴 안내 글에 쓴다. 뷰가 단어 수만큼 늘어나므로(Android) 가상화 목록 행과 행이 많은 목록은 `lineBreakStrategyIOS`만 쓴다([기준](../../../../docs/architecture/ui.md)). 말로 메모 자막은 문장 단위로 가상화해 예외다.
- 글자 선택이 필요한 화면에는 쓰지 않는다. 줄 수 제한(`numberOfLines`)도 지원하지 않는다.
- 창 제목과 짧은 안내는 문구의 `\n`으로 줄을 나눈다(`i18n-guide.md`).

## 접근성

Android는 바깥 표면 하나가 글 전체를 `accessibilityLabel`로 읽고, 단어 뷰는 `importantForAccessibility="no"`로 숨겨 TalkBack이 단어마다 끊어 읽지 않는다.

## 파일 구조

```
word-wrap-text/
├── word-wrap-text.tsx
├── word-wrap-text.md
├── split-text-words.ts
├── split-text-words.test.ts
└── index.ts
```
