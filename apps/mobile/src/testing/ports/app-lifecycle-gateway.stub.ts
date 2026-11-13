import type { AppLifecycleGateway, AppLifecycleState } from '@src/core/ports/app-lifecycle-gateway';

import { mockMethod } from '../mock-method';

export type AppLifecycleGatewayStub = jest.Mocked<AppLifecycleGateway> & {
  /** 상태를 바꾸고 구독자에게 알린다 */
  emit(state: AppLifecycleState): void;
  /** 구독자 수. 정리됐는지 확인할 때 쓴다 */
  getListenerCount(): number;
};

/** 기본은 앞에 떠 있는(active) 앱. `emit`으로 전환을 흉내 낸다 */
export function createAppLifecycleGatewayStub(
  initialState: AppLifecycleState = 'active',
): AppLifecycleGatewayStub {
  let currentState = initialState;
  const listeners = new Set<(state: AppLifecycleState) => void>();

  return {
    getCurrentState: mockMethod<AppLifecycleGateway['getCurrentState']>(() => currentState),
    subscribe: mockMethod<AppLifecycleGateway['subscribe']>((listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    }),
    emit: (state) => {
      currentState = state;
      for (const listener of Array.from(listeners)) {
        listener(state);
      }
    },
    getListenerCount: () => listeners.size,
  };
}
