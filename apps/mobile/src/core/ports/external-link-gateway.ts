/** 앱 밖(브라우저, 스토어, 메일, 기기 설정)으로 나간다. 열지 못하면 reject한다 */
export interface ExternalLinkGateway {
  open(url: string): Promise<void>;
  openInAppBrowser(url: string): Promise<void>;
  openSettings(): Promise<void>;
}
