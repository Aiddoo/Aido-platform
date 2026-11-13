import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { UserConsentRecord } from "../../domain/user-consent.constants.js";
import type { UserPreferenceRecord } from "../../domain/user-preference.constants.js";
import type { DatedTodoCompletionStats } from "./todo-completion-stats.reader.port.js";
import type {
  ConsentSeedInput,
  UserConsentRecordWithId,
  UserConsentRepositoryPort,
} from "./user-consent.repository.port.js";
import type { UserPreferenceRecordWithId } from "./user-preference.repository.port.js";

/** auth가 회원가입 트랜잭션 안에서 사용하는 초기 설정 생성 capability. */
export abstract class UserSettingsProvisionerPort {
  abstract seedDefaults(userId: UserId, consent: ConsentSeedInput): Promise<void>;
}

/** todo가 완료 처리 후 스트릭을 기록하고 조회하는 capability. */
export abstract class UserStreakAccessPort {
  abstract recordTodoToggle(
    userId: UserId,
    completed: boolean,
    timezone: string,
    todayStats: DatedTodoCompletionStats | null,
  ): Promise<void>;
  abstract getPreferenceRecord(userId: UserId): Promise<UserPreferenceRecord | null>;
}

/** planning이 벽시계를 순간으로 바꿀 때 최신 저장값을 읽는 capability. 캐시를 거치지 않는다. */
export abstract class UserTimezoneReaderPort {
  /** 저장된 값 그대로다. 탈퇴했거나 설정이 없으면 null이다. */
  abstract findStoredTimezone(userId: UserId): Promise<string | null>;
}

/** notification이 푸시 발송 판단과 토큰 메타데이터 동기화에 사용하는 capability. */
export abstract class UserNotificationSettingsAccessPort {
  abstract upsertPushTimezone(userId: UserId, timezone: string): Promise<void>;
  abstract upsertPushLocale(userId: UserId, locale: string): Promise<void>;
  abstract getPreferenceRecord(userId: UserId): Promise<UserPreferenceRecord | null>;
  abstract getPreferenceRecordsByUserIds(
    userIds: readonly UserId[],
  ): Promise<UserPreferenceRecordWithId[]>;
  abstract getConsentRecord(userId: UserId): Promise<UserConsentRecord | null>;
  abstract getConsentRecordsByUserIds(
    userIds: readonly UserId[],
  ): Promise<UserConsentRecordWithId[]>;
  abstract updateMarketingPushConsent(userId: UserId, agreed: boolean): Promise<void>;
  abstract findMarketingReconfirmTargets: UserConsentRepositoryPort["findMarketingReconfirmTargets"];
  abstract claimMarketingReconfirm: UserConsentRepositoryPort["claimMarketingReconfirm"];
}
