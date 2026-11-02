export interface NetworkStatusGateway {
  /** 현재 연결 상태로 한 번, 이후 바뀔 때마다 알린다. 반환 함수로 구독을 끝낸다 */
  subscribe(listener: (isOnline: boolean) => void): () => void;
}
