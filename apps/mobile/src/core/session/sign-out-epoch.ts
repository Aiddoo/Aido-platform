import { createEventChannel } from '@src/core/events/event-channel';

/** 세션 만료는 같은 사람이 이어 쓰므로 올리지 않고, 화면 밖 늦은 쓰기가 지운 계정 값을 되살리지 않게 비교한다 */
export interface SignOutEpoch {
  current(): number;
  advance(): void;
  /** 세대가 오를 때 알린다. 늦은 녹음 듣기처럼 화면 밖에서 도는 일을 멈춘다 */
  subscribe(listener: () => void): () => void;
}

// 한 리스너가 던져도 뒤 리스너(늦은 녹음 멈춤 등)는 알림을 받아야 해 이벤트 채널을 쓴다
export function createSignOutEpoch(): SignOutEpoch {
  let epoch = 0;
  const advanced = createEventChannel('sign-out-epoch');

  return {
    current: () => epoch,
    advance: () => {
      epoch += 1;
      advanced.emit();
    },
    subscribe: (listener) => advanced.subscribe(listener),
  };
}
