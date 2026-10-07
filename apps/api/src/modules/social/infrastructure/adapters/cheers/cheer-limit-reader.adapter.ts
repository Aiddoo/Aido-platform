import { Inject, Injectable } from "@nestjs/common";

import { ENTITLEMENT_READER } from "#api/modules/access/access-entitlement.public";
import { type EntitlementReaderPort, Feature } from "#api/modules/access/access-entitlement.public";

import type { CheerLimitReaderPort } from "../../../application/ports/cheers/cheer-limit-reader.port.js";

@Injectable()
export class CheerLimitReaderAdapter implements CheerLimitReaderPort {
  constructor(
    @Inject(ENTITLEMENT_READER) private readonly entitlementReader: Pick<
      EntitlementReaderPort,
      "getFeatureLimitInTx"
    >,
  ) {}

  async getDailyLimitInTx(userId: string): Promise<number | null> {
    const { dailyLimit } = await this.entitlementReader.getFeatureLimitInTx(userId, Feature.CHEER);
    return dailyLimit;
  }
}
