/** 같은 기기에서 초대 보상을 두 번 받지 않게 서버가 해시해 쓰는 설치 식별자(iOS IDFV, Android ID) */
export interface InstallationIdGateway {
  get(): Promise<string | null>;
}
