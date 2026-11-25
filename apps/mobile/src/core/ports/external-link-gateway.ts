/** 기기 설정 앱의 모양. 앱이 바로 열 수 없는 설정(캘린더 계정 추가)으로 가는 길을 글로 안내할 때 고른다 */
export interface SettingsApp {
  /** 접는 휴대폰은 phone, 데스크톱에서 도는 앱은 desktop이다. 휴대폰과 태블릿의 설정이 같은 OS는 phone이다 */
  device: 'phone' | 'tablet' | 'desktop';
  /** 앱마다의 설정이 맨 위 목록이 아니라 "앱" 메뉴 아래에 모여 있다 */
  hasAppsMenu: boolean;
}

/** 앱 밖(브라우저, 스토어, 메일, 기기 설정)으로 나간다. 열지 못하면 reject한다 */
export interface ExternalLinkGateway {
  open(url: string): Promise<void>;
  openInAppBrowser(url: string): Promise<void>;
  /** 이 앱의 설정 화면을 연다. 화면이 없는 기기(`canOpenSettings`가 false)에서는 시스템 설정이 열리거나 아무 일도 없다 */
  openSettings(): Promise<void>;
  /** 이 앱의 설정 화면이 있는 기기인지. Mac(Designed for iPad)은 시스템 설정의 개인정보 보호에서 켜야 해 false다 */
  readonly canOpenSettings: boolean;
  readonly settingsApp: SettingsApp;
}
