export type IosPushAuthorizationStatus =
  | 'NOT_DETERMINED'
  | 'DENIED'
  | 'AUTHORIZED'
  | 'PROVISIONAL'
  | 'EPHEMERAL';

/** OS가 알려 준 알림 권한 원본 값. 발송 허용·다시 묻기 판정은 피처 모델이 한다 */
export interface PushPermissionResponse {
  status: 'granted' | 'denied' | 'undetermined';
  canAskAgain: boolean;
  /** iOS만 주는 세부 허용 상태. 다른 플랫폼은 null */
  iosStatus: IosPushAuthorizationStatus | null;
}

export interface PushNotificationGateway {
  getPermission(): Promise<PushPermissionResponse>;
  requestPermission(): Promise<PushPermissionResponse>;
  /** Android 13+는 채널이 있어야 권한 창과 토큰 발급이 동작한다. 채널이 없는 플랫폼은 아무것도 하지 않는다 */
  ensureChannel(): Promise<void>;
  isPhysicalDevice(): boolean;
  /** Expo 푸시 토큰을 발급한다. 발급에 실패하면 reject한다 */
  getToken(): Promise<string>;
  /** 기기 푸시 토큰이 바뀌면 알린다. 반환 함수로 구독을 끝낸다 */
  addTokenListener(listener: () => void): () => void;
  setBadgeCount(count: number): Promise<void>;
  openSettings(): Promise<void>;
}
