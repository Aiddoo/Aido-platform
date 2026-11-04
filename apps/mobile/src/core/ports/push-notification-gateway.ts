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

/** 사용자가 누른 알림(또는 알림 버튼). data는 서버가 실은 원본이라 읽는 쪽이 검증한다 */
export interface PushNotificationResponse {
  /** 알림 요청 식별자. 같은 알림의 중복 처리를 가르는 데 쓴다 */
  id: string;
  actionIdentifier: string;
  data: Record<string, unknown>;
}

/** 앱이 켜진 동안 도착한 알림 */
export interface ReceivedPushNotification {
  data: Record<string, unknown>;
}

export interface PushNotificationCategory {
  identifier: string;
  actions: readonly {
    identifier: string;
    title: string;
    opensAppToForeground: boolean;
  }[];
}

export interface PushNotificationGateway {
  getPermission(): Promise<PushPermissionResponse>;
  requestPermission(): Promise<PushPermissionResponse>;
  /** Android 13+는 채널이 있어야 권한 창과 토큰 발급이 동작한다. 채널이 없는 플랫폼은 아무것도 하지 않는다 */
  ensureChannel(): Promise<void>;
  /** Expo 푸시 토큰을 발급한다. 오프라인·APNs 없는 시뮬레이터·Play 서비스 없는 에뮬레이터에서는 reject한다 */
  getToken(): Promise<string>;
  /** 기기 푸시 토큰이 바뀌면 알린다. 반환 함수로 구독을 끝낸다 */
  addTokenListener(listener: () => void): () => void;
  /** 앱이 켜진 동안 알림이 도착하면 알린다. 반환 함수로 구독을 끝낸다 */
  addReceivedListener(listener: (notification: ReceivedPushNotification) => void): () => void;
  /** 사용자가 알림을 누르면 알린다. 반환 함수로 구독을 끝낸다 */
  addResponseListener(listener: (response: PushNotificationResponse) => void): () => void;
  /** 마지막 응답이 지워지면 알린다. 반환 함수로 구독을 끝낸다 */
  addResponseClearedListener(listener: () => void): () => void;
  /** 앱이 꺼진 상태에서 알림을 눌러 시작했다면 그 응답. 없으면 null */
  getLastResponse(): PushNotificationResponse | null;
  /** 처리한 마지막 응답을 지운다. 지원하지 않는 환경에서는 throw할 수 있다 */
  clearLastResponse(): void;
  /** 알림 버튼 묶음을 등록한다 */
  setCategory(category: PushNotificationCategory): Promise<void>;
  setBadgeCount(count: number): Promise<void>;
  openSettings(): Promise<void>;
}
