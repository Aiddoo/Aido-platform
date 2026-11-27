/** 초대 보상을 두 번 받지 않게 쓰는 설치 식별자. iOS는 키체인에 남긴 IDFV라 재설치 뒤에도 같고 Android는 Android ID다 */
export interface InstallationIdGateway {
  get(): Promise<string | null>;
}
