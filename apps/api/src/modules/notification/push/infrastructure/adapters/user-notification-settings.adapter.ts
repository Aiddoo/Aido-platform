import { Inject, Injectable } from "@nestjs/common";

import {
  type MarketingReconfirmTarget,
  type UserConsentRecord,
  type UserConsentRecordWithId,
  UserNotificationSettingsAccessPort,
  type UserPreferenceRecord,
  type UserPreferenceRecordWithId,
} from "#api/modules/identity/identity-settings.public";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

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

  upsertPushTimezone(userId: string, timezone: string): Promise<void> {
    return this.#userSettingsAccess.upsertPushTimezone(UserId.reconstitute(userId), timezone);
  }

  upsertPushLocale(userId: string, locale: string): Promise<void> {
    return this.#userSettingsAccess.upsertPushLocale(UserId.reconstitute(userId), locale);
  }

  getPreferenceRecord(userId: string): Promise<UserPreferenceRecord | null> {
    return this.#userSettingsAccess.getPreferenceRecord(UserId.reconstitute(userId));
  }

  getPreferenceRecordsByUserIds(userIds: string[]): Promise<UserPreferenceRecordWithId[]> {
    return this.#userSettingsAccess.getPreferenceRecordsByUserIds(
      userIds.map((userId) => UserId.reconstitute(userId)),
    );
  }

  getConsentRecord(userId: string): Promise<UserConsentRecord | null> {
    return this.#userSettingsAccess.getConsentRecord(UserId.reconstitute(userId));
  }

  getConsentRecordsByUserIds(userIds: string[]): Promise<UserConsentRecordWithId[]> {
    return this.#userSettingsAccess.getConsentRecordsByUserIds(
      userIds.map((userId) => UserId.reconstitute(userId)),
    );
  }

  async updateMarketingPushConsent(userId: string, agreed: boolean): Promise<void> {
    await this.#userSettingsAccess.updateMarketingPushConsent(UserId.reconstitute(userId), agreed);
  }

  findMarketingReconfirmTargets(params: {
    readonly cutoff: Temporal.Instant;
    readonly afterUserId?: string;
    readonly limit: number;
  }): Promise<MarketingReconfirmTarget[]> {
    return this.#userSettingsAccess.findMarketingReconfirmTargets({
      ...params,
      afterUserId: params.afterUserId == null ? undefined : UserId.reconstitute(params.afterUserId),
    });
  }

  claimMarketingReconfirm(
    userIds: readonly string[],
    params: { readonly cutoff: Temporal.Instant; readonly at: Temporal.Instant },
  ): Promise<MarketingReconfirmTarget[]> {
    return this.#userSettingsAccess.claimMarketingReconfirm(
      userIds.map((userId) => UserId.reconstitute(userId)),
      params,
    );
  }
}
