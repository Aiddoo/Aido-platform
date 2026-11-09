/** 앱이 사용자 앞에 있는지. `unknown`은 OS가 아직 알려 주지 않은 상태다 */
export type AppLifecycleState = 'active' | 'inactive' | 'background' | 'unknown';

export interface AppLifecycleGateway {
  getCurrentState(): AppLifecycleState;
  /** 상태가 바뀔 때마다 알린다(현재 상태는 알리지 않는다). 반환 함수로 구독을 끝낸다 */
  subscribe(listener: (state: AppLifecycleState) => void): () => void;
}
