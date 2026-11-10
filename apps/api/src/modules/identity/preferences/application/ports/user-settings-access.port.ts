import type { UserConsentRecord } from "../../domain/user-consent.constants.js";
import type { UserPreferenceRecord } from "../../domain/user-preference.constants.js";
import type {
  ConsentSeedInput,
  UserConsentRecordWithId,
  UserConsentRepositoryPort,
} from "./user-consent.repository.port.js";
import type { UserPreferenceRecordWithId } from "./user-preference.repository.port.js";

export const USER_SETTINGS_PROVISIONER = Symbol("USER_SETTINGS_PROVISIONER");
export const USER_STREAK_ACCESS = Symbol("USER_STREAK_ACCESS");
export const USER_NOTIFICATION_SETTINGS_ACCESS = Symbol("USER_NOTIFICATION_SETTINGS_ACCESS");
export const USER_TIMEZONE_READER = Symbol("USER_TIMEZONE_READER");

/** auth가 회원가입 트랜잭션 안에서 사용하는 초기 설정 생성 capability. */
export interface UserSettingsProvisionerPort {
  seedDefaults(userId: string, consent: ConsentSeedInput): Promise<void>;
}

/** todo가 완료 처리 후 스트릭을 기록하고 조회하는 capability. */
export interface UserStreakAccessPort {
  recordTodoToggle(userId: string, completed: boolean, timezone: string): Promise<void>;
  getPreferenceRecord(userId: string): Promise<UserPreferenceRecord | null>;
}

/** planning이 벽시계를 순간으로 바꿀 때 최신 저장값을 읽는 capability. 캐시를 거치지 않는다. */
export interface UserTimezoneReaderPort {
  /** 저장된 값 그대로다. 탈퇴했거나 설정이 없으면 null이다. */
  findStoredTimezone(userId: string): Promise<string | null>;
}

/** notification이 푸시 발송 판단과 토큰 메타데이터 동기화에 사용하는 capability. */
export interface UserNotificationSettingsAccessPort {
  upsertPushTimezone(userId: string, timezone: string): Promise<void>;
  upsertPushLocale(userId: string, locale: string): Promise<void>;
  getPreferenceRecord(userId: string): Promise<UserPreferenceRecord | null>;
  getPreferenceRecordsByUserIds(userIds: string[]): Promise<UserPreferenceRecordWithId[]>;
  getConsentRecord(userId: string): Promise<UserConsentRecord | null>;
  getConsentRecordsByUserIds(userIds: string[]): Promise<UserConsentRecordWithId[]>;
  updateMarketingPushConsent(userId: string, agreed: boolean): Promise<void>;
  findMarketingReconfirmTargets: UserConsentRepositoryPort["findMarketingReconfirmTargets"];
  claimMarketingReconfirm: UserConsentRepositoryPort["claimMarketingReconfirm"];
}
