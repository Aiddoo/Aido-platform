/** 플랫폼이 주는 기기 식별자. iOS는 IDFV, Android는 Android ID이고 읽을 수 없으면 null이다. */
export interface VendorIdGateway {
  get(): Promise<string | null>;
}
