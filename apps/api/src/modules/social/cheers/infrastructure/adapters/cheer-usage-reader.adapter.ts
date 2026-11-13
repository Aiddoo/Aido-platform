import { Injectable } from "@nestjs/common";

import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { DailySendUsage } from "../../../shared/application/ports/daily-send-usage.reader.port.js";
import type { CheerUsageReaderPort } from "../../application/ports/cheer-usage.reader.port.js";
import { GetDailyCheerUsageUseCase } from "../../application/use-cases/get-daily-cheer-usage.use-case.js";

@Injectable()
export class CheerUsageReaderAdapter implements CheerUsageReaderPort {
  readonly #getDailyCheerUsage: GetDailyCheerUsageUseCase;

  constructor(getDailyCheerUsage: GetDailyCheerUsageUseCase) {
    this.#getDailyCheerUsage = getDailyCheerUsage;
  }

  readDailyUsage(userId: UserId, timezone: string): Promise<DailySendUsage> {
    return this.#getDailyCheerUsage.execute({ userId: userId.value, timezone });
  }
}
