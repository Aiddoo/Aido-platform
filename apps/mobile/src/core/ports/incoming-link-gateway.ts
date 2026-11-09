export interface IncomingLinkGateway {
  /** 앱을 띄운 링크. 없으면 null */
  getInitialUrl(): Promise<string | null>;
  /** 실행 중에 새 링크가 들어오면 알린다. 반환 함수로 구독을 끝낸다 */
  subscribe(listener: () => void): () => void;
}
