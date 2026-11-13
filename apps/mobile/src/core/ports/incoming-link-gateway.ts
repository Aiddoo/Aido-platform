export interface IncomingLinkGateway {
  /** 앱을 띄운 링크. 없으면 null */
  getInitialUrl(): Promise<string | null>;
  /** 실행 중에 링크가 들어올 때마다 그 URL로 알린다. 같은 링크를 다시 열어도 알린다. 반환 함수로 구독을 끝낸다 */
  subscribe(listener: (url: string) => void): () => void;
}
