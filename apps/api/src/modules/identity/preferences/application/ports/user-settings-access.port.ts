import type { UserConsentRecord } from "../../domain/user-consent.constants.js";
import type { UserPreferenceRecord } from "../../domain/user-preference.constants.js";
import type {
  ConsentSeedInput,
  UserConsentRecordWithId,
  UserConsentRepositoryPort,
} from "./user-consent.repository.port.js";
import type { UserPreferenceRecordWithId } from "./user-preference.repository.port.js";

/** 옛 토큰. 아직 옮기지 않은 소비 Context가 쓴다(같은 인스턴스 별칭으로 바인딩) */
export const USER_SETTINGS_PROVISIONER = Symbol("USER_SETTINGS_PROVISIONER");
/** 옛 토큰. 아직 옮기지 않은 소비 Context가 쓴다(같은 인스턴스 별칭으로 바인딩) */
export const USER_STREAK_ACCESS = Symbol("USER_STREAK_ACCESS");
/** 옛 토큰. 아직 옮기지 않은 소비 Context가 쓴다(같은 인스턴스 별칭으로 바인딩) */
export const USER_NOTIFICATION_SETTINGS_ACCESS = Symbol("USER_NOTIFICATION_SETTINGS_ACCESS");
/** 옛 토큰. 아직 옮기지 않은 소비 Context가 쓴다(같은 인스턴스 별칭으로 바인딩) */
export const USER_TIMEZONE_READER = Symbol("USER_TIMEZONE_READER");

/** auth가 회원가입 트랜잭션 안에서 사용하는 초기 설정 생성 capability. */
export abstract class UserSettingsProvisionerPort {
  abstract seedDefaults(userId: string, consent: ConsentSeedInput): Promise<void>;
}

/** todo가 완료 처리 후 스트릭을 기록하고 조회하는 capability. */
export abstract class UserStreakAccessPort {
  abstract recordTodoToggle(userId: string, completed: boolean, timezone: string): Promise<void>;
  abstract getPreferenceRecord(userId: string): Promise<UserPreferenceRecord | null>;
}

/** planning이 벽시계를 순간으로 바꿀 때 최신 저장값을 읽는 capability. 캐시를 거치지 않는다. */
export abstract class UserTimezoneReaderPort {
  /** 저장된 값 그대로다. 탈퇴했거나 설정이 없으면 null이다. */
  abstract findStoredTimezone(userId: string): Promise<string | null>;
}

/** notification이 푸시 발송 판단과 토큰 메타데이터 동기화에 사용하는 capability. */
export abstract class UserNotificationSettingsAccessPort {
  abstract upsertPushTimezone(userId: string, timezone: string): Promise<void>;
  abstract upsertPushLocale(userId: string, locale: string): Promise<void>;
  abstract getPreferenceRecord(userId: string): Promise<UserPreferenceRecord | null>;
  abstract getPreferenceRecordsByUserIds(userIds: string[]): Promise<UserPreferenceRecordWithId[]>;
  abstract getConsentRecord(userId: string): Promise<UserConsentRecord | null>;
  abstract getConsentRecordsByUserIds(userIds: string[]): Promise<UserConsentRecordWithId[]>;
  abstract updateMarketingPushConsent(userId: string, agreed: boolean): Promise<void>;
  abstract findMarketingReconfirmTargets: UserConsentRepositoryPort["findMarketingReconfirmTargets"];
  abstract claimMarketingReconfirm: UserConsentRepositoryPort["claimMarketingReconfirm"];
}
