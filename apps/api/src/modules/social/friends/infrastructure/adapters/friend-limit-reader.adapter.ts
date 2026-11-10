import { Inject, Injectable } from "@nestjs/common";

import { EntitlementReaderPort } from "#api/modules/access/entitlements/access-entitlements.public";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import {
  FriendLimitReaderPort,
  type FriendFeatureQuota,
} from "../../application/ports/friend-limit.reader.port.js";

@Injectable()
export class FriendLimitReaderAdapter extends FriendLimitReaderPort {
  readonly #entitlementReader: Pick<
    EntitlementReaderPort,
    "getFeatureLimit" | "getFeatureLimitInTx" | "getFeatureQuotaInTx"
  >;

  constructor(
    @Inject(EntitlementReaderPort)
    entitlementReader: Pick<
      EntitlementReaderPort,
      "getFeatureLimit" | "getFeatureLimitInTx" | "getFeatureQuotaInTx"
    >,
  ) {
    super();
    this.#entitlementReader = entitlementReader;
  }

  readLimit(userId: UserId): Promise<number | null> {
    return this.#entitlementReader.getFeatureLimit(userId.value, "FRIEND");
  }

  readLimitInTx(userId: UserId): Promise<number | null> {
    return this.#entitlementReader.getFeatureLimitInTx(userId.value, "FRIEND");
  }

  readFeatureQuotaInTx(userId: UserId, friendCount: number): Promise<FriendFeatureQuota> {
    return this.#entitlementReader.getFeatureQuotaInTx(userId.value, "FRIEND", {
      used: friendCount,
      resetsAt: null,
    });
  }
}
