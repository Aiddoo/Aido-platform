/** 앱 밖(브라우저, 스토어, 메일, 기기 설정)으로 나간다. 열지 못하면 reject한다 */
export interface ExternalLinkGateway {
  open(url: string): Promise<void>;
  openInAppBrowser(url: string): Promise<void>;
  openSettings(): Promise<void>;
}

/** 링크로 앱에 들어온다 */
export interface IncomingLinkGateway {
  /** 앱을 띄운 링크. 없으면 null */
  getInitialUrl(): Promise<string | null>;
  /** 실행 중에 새 링크가 들어오면 알린다. 반환 함수로 구독을 끝낸다 */
  subscribe(listener: () => void): () => void;
}
