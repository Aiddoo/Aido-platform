import { Inject, Injectable } from "@nestjs/common";

import {
  ENTITLEMENT_READER,
  type EntitlementReaderPort,
} from "#api/modules/access/access-entitlement.public";

import type { CheerLimitReaderPort } from "../../../application/ports/cheers/cheer-limit-reader.port.js";

@Injectable()
export class CheerLimitReaderAdapter implements CheerLimitReaderPort {
  constructor(
    @Inject(ENTITLEMENT_READER) private readonly entitlementReader: Pick<
      EntitlementReaderPort,
      "limitOfInTx"
    >,
  ) {}

  async getDailyLimitInTx(userId: string): Promise<number | null> {
    return this.entitlementReader.limitOfInTx(userId, "CHEER");
  }
}
