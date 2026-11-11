import { Inject, Injectable } from "@nestjs/common";

import {
  type MarketingReconfirmTarget,
  type UserConsentRecord,
  type UserConsentRecordWithId,
  UserNotificationSettingsAccessPort,
  type UserPreferenceRecord,
  type UserPreferenceRecordWithId,
} from "#api/modules/identity/identity-settings.public";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { MarketingConsentReconfirmPort } from "../../application/ports/marketing-consent-reconfirm.port.js";
import type { UserNotificationSettingsPort } from "../../application/ports/user-notification-settings.port.js";

/**
 * notification의 설정 포트를 user-settings의 공개 capability에 연결한다.
 */
@Injectable()
export class UserNotificationSettingsAdapter
  implements UserNotificationSettingsPort, MarketingConsentReconfirmPort
{
  readonly #userSettingsAccess: UserNotificationSettingsAccessPort;

  constructor(
    @Inject(UserNotificationSettingsAccessPort)
    userSettingsAccess: UserNotificationSettingsAccessPort,
  ) {
    this.#userSettingsAccess = userSettingsAccess;
  }

  upsertPushTimezone(userId: UserId, timezone: string): Promise<void> {
    return this.#userSettingsAccess.upsertPushTimezone(userId, timezone);
  }

  upsertPushLocale(userId: UserId, locale: string): Promise<void> {
    return this.#userSettingsAccess.upsertPushLocale(userId, locale);
  }

  getPreferenceRecord(userId: UserId): Promise<UserPreferenceRecord | null> {
    return this.#userSettingsAccess.getPreferenceRecord(userId);
  }

  getPreferenceRecordsByUserIds(userIds: readonly UserId[]): Promise<UserPreferenceRecordWithId[]> {
    return this.#userSettingsAccess.getPreferenceRecordsByUserIds(userIds);
  }

  getConsentRecord(userId: UserId): Promise<UserConsentRecord | null> {
    return this.#userSettingsAccess.getConsentRecord(userId);
  }

  getConsentRecordsByUserIds(userIds: readonly UserId[]): Promise<UserConsentRecordWithId[]> {
    return this.#userSettingsAccess.getConsentRecordsByUserIds(userIds);
  }

  async updateMarketingPushConsent(userId: UserId, agreed: boolean): Promise<void> {
    await this.#userSettingsAccess.updateMarketingPushConsent(userId, agreed);
  }

  findMarketingReconfirmTargets(params: {
    readonly cutoff: Temporal.Instant;
    readonly afterUserId?: UserId;
    readonly limit: number;
  }): Promise<MarketingReconfirmTarget[]> {
    return this.#userSettingsAccess.findMarketingReconfirmTargets({
      cutoff: params.cutoff,
      afterUserId: params.afterUserId,
      limit: params.limit,
    });
  }

  claimMarketingReconfirm(
    userIds: readonly UserId[],
    params: { readonly cutoff: Temporal.Instant; readonly at: Temporal.Instant },
  ): Promise<MarketingReconfirmTarget[]> {
    return this.#userSettingsAccess.claimMarketingReconfirm(userIds, params);
  }
}
