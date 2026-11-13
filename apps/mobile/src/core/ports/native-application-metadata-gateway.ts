/** 네이티브가 주지 않는 칸은 null이다 */
export interface NativeApplicationMetadata {
  platform: string | null;
  currentVersion: string | null;
  /** 네이티브 빌드 번호 (iOS CFBundleVersion, Android versionCode) */
  currentBuild: string | null;
  /** iOS bundle id, Android 패키지 이름 */
  applicationId: string | null;
}

export interface NativeApplicationMetadataGateway {
  /** Expo Go처럼 설치 정보를 모르면 null */
  getInstallation(): NativeApplicationMetadata | null;
}
