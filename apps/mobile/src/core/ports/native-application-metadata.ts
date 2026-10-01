export interface NativeApplicationMetadata {
  platform: string | undefined;
  currentVersion: string | undefined;
}

export interface NativeApplicationMetadataGateway {
  getInstallation(): NativeApplicationMetadata | undefined;
}
