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
  id: string;
  actionIdentifier: string;
  data: Record<string, unknown>;
}

export interface ReceivedPushNotification {
  data: Record<string, unknown>;
}

/** 앱이 앞에 있을 때 받은 알림을 보이는 방식. `quiet`는 배너와 소리 없이 알림 센터에만 남긴다 */
export type ForegroundPushPresentation = 'banner' | 'quiet';

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
  /** 서버에 등록할 푸시 토큰을 발급한다. 오프라인·APNs 없는 시뮬레이터·Play 서비스 없는 에뮬레이터에서는 reject한다 */
  getToken(): Promise<string>;
  /** 기기 푸시 토큰이 바뀌면 알린다. 반환 함수로 구독을 끝낸다 */
  subscribeToken(listener: () => void): () => void;
  subscribeReceived(listener: (notification: ReceivedPushNotification) => void): () => void;
  subscribeResponse(listener: (response: PushNotificationResponse) => void): () => void;
  /** 앱이 꺼진 상태에서 알림을 눌러 시작했다면 그 응답. 없으면 null */
  getLastResponse(): PushNotificationResponse | null;
  /** 처리한 마지막 응답을 지운다. 지원하지 않는 환경에서는 throw할 수 있다 */
  clearLastResponse(): void;
  setCategory(category: PushNotificationCategory): Promise<void>;
  setBadgeCount(count: number): Promise<void>;
  /** 앱이 앞에 있을 때 받은 알림을 어떻게 보일지 정한다. 반환 함수로 기본(배너)으로 되돌린다 */
  setForegroundPresentation(
    decide: (notification: ReceivedPushNotification) => ForegroundPushPresentation,
  ): () => void;
}
