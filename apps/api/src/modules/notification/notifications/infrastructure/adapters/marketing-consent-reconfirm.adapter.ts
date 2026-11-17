import { Inject, Injectable } from "@nestjs/common";

import {
  type MarketingReconfirmTarget,
  UserNotificationSettingsAccessPort,
} from "#api/modules/identity/user-preferences/identity-user-preferences.public";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type {
  MarketingConsentReconfirmPort,
  MarketingReconfirmRecipient,
} from "../../application/ports/marketing-consent-reconfirm.port.js";

@Injectable()
export class MarketingConsentReconfirmAdapter implements MarketingConsentReconfirmPort {
  readonly #userSettingsAccess: UserNotificationSettingsAccessPort;

  constructor(
    @Inject(UserNotificationSettingsAccessPort)
    userSettingsAccess: UserNotificationSettingsAccessPort,
  ) {
    this.#userSettingsAccess = userSettingsAccess;
  }

  async findMarketingReconfirmTargets(params: {
    readonly cutoff: Temporal.Instant;
    readonly afterUserId?: UserId;
    readonly limit: number;
  }): Promise<MarketingReconfirmRecipient[]> {
    const targets = await this.#userSettingsAccess.findMarketingReconfirmTargets({
      cutoff: params.cutoff,
      afterUserId: params.afterUserId,
      limit: params.limit,
    });
    return targets.map(toMarketingReconfirmRecipient);
  }

  async claimMarketingReconfirm(
    userIds: readonly UserId[],
    params: { readonly cutoff: Temporal.Instant; readonly at: Temporal.Instant },
  ): Promise<MarketingReconfirmRecipient[]> {
    const claimed = await this.#userSettingsAccess.claimMarketingReconfirm(userIds, params);
    return claimed.map(toMarketingReconfirmRecipient);
  }
}

function toMarketingReconfirmRecipient(
  target: MarketingReconfirmTarget,
): MarketingReconfirmRecipient {
  return {
    userId: UserId.reconstitute(target.userId),
    marketingAgreedAt: target.marketingAgreedAt,
    marketingPushAgreedAt: target.marketingPushAgreedAt,
  };
}
