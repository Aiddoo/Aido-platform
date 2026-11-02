export interface NativeApplicationMetadata {
  platform: string | undefined;
  currentVersion: string | undefined;
  /** 네이티브 빌드 번호 (iOS CFBundleVersion, Android versionCode) */
  currentBuild?: string;
}

export interface NativeApplicationMetadataGateway {
  getInstallation(): NativeApplicationMetadata | undefined;
}
