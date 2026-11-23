import { Inject, Injectable } from "@nestjs/common";

import { EntitlementReaderPort } from "#api/modules/access/feature-grants/access-feature-grants.public";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import {
  FriendLimitReaderPort,
  type FriendFeatureQuota,
} from "../../application/ports/friend-limit.reader.port.js";

@Injectable()
export class FriendLimitReaderAdapter extends FriendLimitReaderPort {
  readonly #entitlementReader: Pick<
    EntitlementReaderPort,
    "findFeatureLimit" | "findFeatureLimitInTransaction" | "getFeatureQuotaInTransaction"
  >;

  constructor(
    @Inject(EntitlementReaderPort)
    entitlementReader: Pick<
      EntitlementReaderPort,
      "findFeatureLimit" | "findFeatureLimitInTransaction" | "getFeatureQuotaInTransaction"
    >,
  ) {
    super();
    this.#entitlementReader = entitlementReader;
  }

  readLimit(userId: UserId): Promise<number | null> {
    return this.#entitlementReader.findFeatureLimit(userId, "FRIEND");
  }

  readLimitInTransaction(userId: UserId): Promise<number | null> {
    return this.#entitlementReader.findFeatureLimitInTransaction(userId, "FRIEND");
  }

  readFeatureQuotaInTransaction(userId: UserId, friendCount: number): Promise<FriendFeatureQuota> {
    return this.#entitlementReader.getFeatureQuotaInTransaction(userId, "FRIEND", {
      used: friendCount,
      resetsAt: null,
    });
  }
}
