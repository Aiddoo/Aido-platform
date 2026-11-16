# RedactedText

결제하면 보이는 글자를 무료 화면에서 가리는 둥근 막대다. 블러 대신 글자 줄 모양만 남겨 무엇이 더 있는지 보이게 한다.
블러는 Android·저사양에서 비용이 크고 플랫폼마다 모양이 달라 쓰지 않는다.

## 사용법

```tsx
import { RedactedText } from '@src/shared/ui';

<RedactedText size="b4" lineCount={2} accessibilityLabel={t('report.teaser.hiddenLabel')} />
<RedactedText size="b4" className="w-32" accessibilityLabel={t('report.teaser.hiddenLabel')} />
```

## Props

| Prop               | 타입       | 기본값 | 설명                                                        |
| ------------------ | ---------- | ------ | ----------------------------------------------------------- |
| size               | `TextSize` | `'b3'` | 가린 글자의 크기. 줄 높이·막대 두께가 같은 `Text`와 같다    |
| lineCount          | `number`   | `1`    | 가린 줄 수. 여러 줄이면 마지막 줄이 60% 폭이다              |
| accessibilityLabel | `string`   | -      | 스크린 리더가 읽는 말. 무엇이 가려졌고 어디서 보는지 말한다 |
| className          | `string`   | -      | 폭 등 배치만 정한다. 폭을 주지 않으면 부모를 채운다         |
| testID             | `string`   | -      |                                                             |

## 동작

- 면은 `TextSkeleton`과 같은 heroui `Skeleton`(`dark:bg-gray-2`)이고 `variant="none"`이라 움직이지 않는다. 불러오는 중은 움직이고 가린 글자는 멈춰 있다.
- 글꼴 단계를 따라 줄 높이가 함께 커져 글자로 바뀌어도 자리가 같다.
- 줄 묶음 전체가 접근성 요소 하나(`text`)다. 줄마다 읽지 않는다.
- 가린 이유(프리미엄 등)는 쓰는 쪽이 근처 글자로 함께 보인다.
