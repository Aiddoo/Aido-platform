import { Inject, Injectable } from "@nestjs/common";

import {
  EntitlementReaderPort,
  isExemptFromDormancy,
} from "#api/modules/access/entitlements/access-entitlements.public";
import { UserActivityReaderPort } from "#api/modules/identity/identity-user-access.public";
import { isSeriesOwnerDormant } from "#api/modules/planning/todo-series/planning-todo-series-dormancy.public";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { TimeZone } from "#api/shared/domain/time/time-zone.vo";
import { localDateOf } from "#api/shared/domain/time/zoned-time";

import { TodoSeriesOwnerDormancyPort } from "../../application/ports/todo-series-owner-dormancy.port.js";

/** planning이 notification을 조립하므로 모듈 대신 순수 정책만 받아 쓴다. */
@Injectable()
export class TodoSeriesOwnerDormancyAdapter extends TodoSeriesOwnerDormancyPort {
  readonly #activityReader: UserActivityReaderPort;
  readonly #entitlementReader: Pick<EntitlementReaderPort, "getEntitlements">;
  readonly #clock: ClockPort;

  constructor(
    @Inject(UserActivityReaderPort) activityReader: UserActivityReaderPort,
    @Inject(EntitlementReaderPort) entitlementReader: Pick<
      EntitlementReaderPort,
      "getEntitlements"
    >,
    clock: ClockPort,
  ) {
    super();
    this.#activityReader = activityReader;
    this.#entitlementReader = entitlementReader;
    this.#clock = clock;
  }

  async findDormantSince(userId: string): Promise<string | null> {
    const [account] = await this.#activityReader.findActiveAccounts([userId]);
    if (account == null) {
      return null;
    }
    if (!isSeriesOwnerDormant(account, this.#clock.now())) {
      return null;
    }
    const { plan } = await this.#entitlementReader.getEntitlements(UserId.reconstitute(userId));
    // 휴면 시작일은 지금처럼 UTC 달력 날짜로 알린다
    return isExemptFromDormancy(plan)
      ? null
      : localDateOf(account.lastActiveAt ?? account.signedUpAt, TimeZone.UTC).toString();
  }
}
