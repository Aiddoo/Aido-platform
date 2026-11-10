import { Inject, Injectable } from "@nestjs/common";

import {
  ENTITLEMENT_READER,
  type EntitlementReaderPort,
} from "#api/modules/access/access-entitlement.public";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type {
  FriendLimitReaderPort,
  FriendQuota,
} from "../../application/ports/friend-limit.reader.port.js";

@Injectable()
export class FriendLimitReaderAdapter implements FriendLimitReaderPort {
  readonly #entitlementReader: Pick<
    EntitlementReaderPort,
    "getLimit" | "getLimitInTx" | "readFeatureQuotaInTx"
  >;

  constructor(
    @Inject(ENTITLEMENT_READER)
    entitlementReader: Pick<
      EntitlementReaderPort,
      "getLimit" | "getLimitInTx" | "readFeatureQuotaInTx"
    >,
  ) {
    this.#entitlementReader = entitlementReader;
  }

  readMaxFriendCount(userId: UserId): Promise<number | null> {
    return this.#entitlementReader.getLimit(userId.value, "FRIEND");
  }

  readMaxFriendCountInTx(userId: UserId): Promise<number | null> {
    return this.#entitlementReader.getLimitInTx(userId.value, "FRIEND");
  }

  readQuotaInTx(userId: UserId, friendCount: number): Promise<FriendQuota> {
    return this.#entitlementReader.readFeatureQuotaInTx(userId.value, "FRIEND", {
      used: friendCount,
      resetsAt: null,
    });
  }
}
