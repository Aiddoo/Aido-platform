/**
 * 관리자 알림 이벤트 페이로드 정의
 *
 * 회원가입 등 관리자 알림에 필요한 페이로드 타입을 정의합니다.
 * BullMQ AdminNotificationQueue에서 사용됩니다.
 */

/**
 * 회원가입 이벤트 페이로드
 */
export interface UserRegisteredEventPayload {
  /** 신규 사용자 ID */
  readonly userId: string;
  /** 이메일 */
  readonly email: string;
  /** 가입 방식 */
  readonly provider: "credential" | "apple" | "google" | "kakao" | "naver";
  /** 가입 시각 (ISO string) */
  readonly registeredAt: string;
  /** 닉네임/이름 */
  readonly name?: string;
  /** 요청에서 확인된 기기 플랫폼 */
  readonly devicePlatform?: "IOS" | "ANDROID" | "WEB";
  /** 요청에서 확인된 기기 모델 */
  readonly deviceModel?: string;
  /** 기기 OS 버전 (X-OS-Version) */
  readonly osVersion?: string;
  /** 앱 버전 (X-App-Version) */
  readonly appVersion?: string;
  /** 앱 빌드 번호 (X-App-Build) */
  readonly appBuild?: string;
  /** 요청 언어 태그 (Accept-Language 첫 항목) */
  readonly locale?: string;
  /** IANA 시간대 (X-Timezone) */
  readonly timezone?: string;
}
