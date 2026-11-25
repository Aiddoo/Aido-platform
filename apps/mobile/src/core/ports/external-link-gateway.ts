/** 앱 밖(브라우저, 스토어, 메일, 기기 설정)으로 나간다. 열지 못하면 reject한다 */
export interface ExternalLinkGateway {
  open(url: string): Promise<void>;
  openInAppBrowser(url: string): Promise<void>;
  /** 이 앱의 설정 화면을 연다. 화면이 없는 기기(`canOpenSettings`가 false)에서는 시스템 설정이 열리거나 아무 일도 없다 */
  openSettings(): Promise<void>;
  /** 이 앱의 설정 화면이 있는 기기인지. Mac(Designed for iPad)은 시스템 설정의 개인정보 보호에서 켜야 해 false다 */
  readonly canOpenSettings: boolean;
}
