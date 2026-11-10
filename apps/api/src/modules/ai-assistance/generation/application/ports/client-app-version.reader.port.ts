export const AI_CLIENT_APP_VERSION_READER = Symbol("AI_CLIENT_APP_VERSION_READER");

/** 예약 작업이 사용자의 앱이 AI 동의를 받는 버전인지 알기 위해 읽는 앱 버전. */
export interface AiClientAppVersionReaderPort {
  /** 사용자가 쓰는 기기 중 가장 높은 앱 버전. 알 수 없으면 null */
  findLatestAppVersion(userId: string): Promise<string | null>;
}
