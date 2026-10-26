/**
 * 같은 기기에서 초대 보상을 두 번 받지 않게 서버가 해시해 쓰는 설치 식별자.
 * iOS는 처음 읽은 IDFV를 키체인에 남겨 재설치 뒤에도 같은 값, Android는 Android ID다.
 */
export interface InstallationIdGateway {
  get(): Promise<string | null>;
}
