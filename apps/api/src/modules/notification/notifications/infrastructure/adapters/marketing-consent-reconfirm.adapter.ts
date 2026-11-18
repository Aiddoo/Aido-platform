import { Inject, Injectable } from "@nestjs/common";

import { UserNotificationSettingsAccessPort } from "#api/modules/identity/user-preferences/identity-user-preferences.public";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

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

  findMarketingReconfirmTargets(params: {
    readonly cutoff: Temporal.Instant;
    readonly afterUserId?: UserId;
    readonly limit: number;
  }): Promise<MarketingReconfirmRecipient[]> {
    return this.#userSettingsAccess.findMarketingReconfirmTargets({
      cutoff: params.cutoff,
      afterUserId: params.afterUserId,
      limit: params.limit,
    });
  }

  claimMarketingReconfirm(
    userIds: readonly UserId[],
    params: { readonly cutoff: Temporal.Instant; readonly at: Temporal.Instant },
  ): Promise<MarketingReconfirmRecipient[]> {
    return this.#userSettingsAccess.claimMarketingReconfirm(userIds, params);
  }
}
