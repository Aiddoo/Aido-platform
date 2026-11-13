# Steps

여러 단계 흐름의 진행 점(`Steps.Dots`)과 이전·다음 버튼(`Steps.Buttons`)입니다. 제품 문구와 바깥 레이아웃은 모르고, 단계 상태는 `useStepper`가 맡습니다.

## 사용법

```tsx
import { Steps } from '@src/shared/ui';

<Steps.Dots index={stepper.index} count={STEP_COUNT} />
<Steps.Buttons
  index={stepper.index}
  isLast={isLast}
  backLabel={t('common:actions.back')}
  nextLabel={isLast ? t('common:actions.done') : t('common:actions.continue')}
  onBack={stepper.history.back}
  onNext={handleNext}
/>
```

## 움직임

- 점 뒤 막대는 현재 단계까지 `withSpring`으로 늘어납니다. 지난 점은 `bg-white dark:bg-gray-9`, 남은 점은 `bg-gray-4`로 `withTiming` 200ms 동안 바뀝니다.
- 넘기는 목록과 함께 쓰면 `progress`(장 위치 SharedValue, 소수)를 넘깁니다. 막대 폭과 점 색이 스프링 없이 손가락을 바로 따라옵니다(혜택 넘기기). `index`는 접근성·처음 값용으로 그대로 넘깁니다.
- 색 카드·그림 위에 얹을 때는 `tone="onMedia"`로 흰 막대(`bg-on-sky`), main 점, 반투명 흰 점(`bg-on-sky/60`)으로 그립니다(혜택 넘기기).
- 첫 단계는 다음 버튼이 전체 폭입니다. 둘째 단계부터 뒤로 버튼이 측정 폭의 25%(간격 10 제외)로 나타납니다(`duration 250`, `dampingRatio 1.5`).
- 마지막 단계(`isLast`)에서는 다음 버튼에 체크 아이콘이 펴지고, 글자는 `nextLabel`이 정합니다.
- 모든 움직임은 UI 스레드 worklet이라 프레임마다 React가 다시 그리지 않습니다. 단계가 바뀔 때만 props가 바뀝니다.
- 움직임 줄이기가 켜져 있으면(`useIsReduceMotionEnabled`) 목표 값으로 바로 갑니다.
- 첫 단계의 뒤로 버튼은 폭이 0이어도 눌리거나 스크린 리더에 읽히지 않게 막습니다.

## 데모와 다른 점

| 데모                         | 이 구현                                                 |
| ---------------------------- | ------------------------------------------------------- |
| `index === 2` 고정           | `isLast` prop                                           |
| `useWindowDimensions` 폭     | 컨테이너 `onLayout` 측정 폭(폴드·분할 화면 대응)        |
| 하드코딩 색·폰트             | 앱 토큰(`bg-main`, `bg-gray-*`)과 `<Text>`, 라이트·다크 |
| `pressto`의 `PressableScale` | heroui-native `PressableFeedback`                       |
| 움직임 줄이기 없음           | `useIsReduceMotionEnabled`                              |

## 출처

[enzomanuelmangano/demos](https://github.com/enzomanuelmangano/demos)의 [src/animations/steps](https://github.com/enzomanuelmangano/demos/tree/main/src/animations/steps) 동작(상호작용과 보이는 모양)을 참고해 앱 안에서 다시 구현했습니다. 그 저장소의 [LICENSE.md](https://github.com/enzomanuelmangano/demos/blob/main/LICENSE.md) 1.1은 앱 안의 구현·수정·상용 사용을 허용하고, 1.2는 코드 재배포와 라이브러리화를 금지합니다. 그래서 원본 코드를 복사하지 않고 앱 전용 값으로 썼으며, 이 컴포넌트를 앱 밖으로 내보내지 않습니다.
