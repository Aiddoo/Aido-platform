import { Inject, Injectable } from "@nestjs/common";

import {
  ENTITLEMENT_READER,
  type EntitlementReaderPort,
} from "#api/modules/access/access-entitlement.public";

import type { NudgeLimitReaderPort } from "../../../application/ports/nudges/nudge-limit-reader.port.js";

@Injectable()
export class NudgeLimitReaderAdapter implements NudgeLimitReaderPort {
  constructor(
    @Inject(ENTITLEMENT_READER) private readonly entitlementReader: Pick<
      EntitlementReaderPort,
      "limitOfInTx"
    >,
  ) {}

  async getDailyLimitInTx(userId: string): Promise<number | null> {
    return this.entitlementReader.limitOfInTx(userId, "NUDGE");
  }
}
