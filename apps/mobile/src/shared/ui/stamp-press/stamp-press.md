# StampPress

도장이 크게 떠 있다가 쿵 찍히고(스프링 400ms, dampingRatio 0.55, 1.7배·-20° → 1배·-6°) 테두리가 한 번 퍼지는(480ms) 연출이다.
초대 발자국 판의 새 발자국과 결제 화면 체험 일정의 찍힌 도장이 같은 연출을 쓴다. 결제 완료 왕관은 `motion="rise"`(0.9배 → 1배, dampingRatio 0.8, 회전 없음)로 같은 테두리 퍼짐을 쓴다.

- 처음 그릴 때 한 번만 재생한다. 반복하지 않는다. 다시 찍으려면 쓰는 쪽이 `key`를 바꿔 새로 그린다.
- transform·opacity만 UI 스레드(Reanimated)에서 바꾸고, 사라지면 `cancelAnimation`으로 멈춘다.
- 동작 줄이기(`useIsReduceMotionEnabled`)가 켜져 있으면 찍힌 모습(-6°)으로 바로 그린다.
- 햅틱은 넣지 않는다. 사용자 행동으로 찍힐 때만 쓰는 쪽이 울린다.

```tsx
import { StampPress } from '@src/shared/ui';

<StampPress delay={order * 160}>
  <IconCircle tone="brand" icon={<PawIcon … />} />
</StampPress>;
```

| Prop           | 타입        | 기본값 | 설명                                      |
| -------------- | ----------- | ------ | ----------------------------------------- |
| children       | `ReactNode` | -      | 찍을 도장                                 |
| delay          | `number`    | `0`    | 여러 도장을 차례로 찍을 때 늦출 시간(ms)  |
| burstClassName | `string`    | -      | 퍼지는 테두리 모양(기본 main 둥근 테두리) |
| className      | `string`    | -      | 바깥 상자 배치(예: `flex-1`)              |
