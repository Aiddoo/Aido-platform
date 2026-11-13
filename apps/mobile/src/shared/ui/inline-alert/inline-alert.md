# InlineAlert

흐름 안에서 할 일이나 상태를 알리는 배너의 유일한 부품이다. heroui `Alert` + `CloseButton` 위에 앱 글꼴 `<Text>`를 얹는다.
특정 버튼을 가리키는 첫 안내(말풍선)는 `CoachmarkPopover`가 맡는다.

## 사용법

```tsx
import { Button, InlineAlert } from '@src/shared/ui';

<InlineAlert
  status="warning"
  title={t('notice.title')}
  description={t('notice.description')}
  action={<Button size="small">{t('notice.action')}</Button>}
  onClose={dismiss}
/>;
```

## Props

| Prop        | 타입                                                | 설명                                               |
| ----------- | --------------------------------------------------- | -------------------------------------------------- |
| title       | `ReactNode`                                         | 제목. 비우면 description만 있는 한 문장 안내다     |
| description | `string`                                            | 설명                                               |
| image       | `ReactNode`                                         | 제목 앞 그림. 없으면 기본 표시, `null`이면 안 그림 |
| action      | `ReactNode`                                         | 설명 아래 행동                                     |
| onPress     | `() => void`                                        | 닫기 버튼을 뺀 자리 전체가 눌린다                  |
| pressLabel  | `string`                                            | 눌리는 자리의 스크린 리더 이름                     |
| onClose     | `() => void`                                        | 넘기면 닫기 버튼을 그린다                          |
| closeLabel  | `string`                                            | 닫기 스크린 리더 이름(기본 `common:actions.close`) |
| status      | `default \| accent \| success \| warning \| danger` | heroui `Alert` 원본. 상태 색은 의미에만 쓴다       |
| ...props    | `Alert` 원본(`children` 제외)                       | `className` 등                                     |

## 규칙

- 글자는 heroui 라벨이 아닌 앱 `<Text>`로 넣는다(앱 글꼴 크기 5단계를 따른다).
- 바깥 여백과 폭은 부모가 정한다.
