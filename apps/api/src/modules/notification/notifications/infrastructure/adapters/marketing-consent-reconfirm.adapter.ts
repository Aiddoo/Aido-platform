import { Inject, Injectable } from "@nestjs/common";

import {
  type MarketingReconfirmTarget,
  UserNotificationSettingsAccessPort,
} from "#api/modules/identity/identity-settings.public";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { MarketingConsentReconfirmPort } from "../../application/ports/marketing-consent-reconfirm.port.js";

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
