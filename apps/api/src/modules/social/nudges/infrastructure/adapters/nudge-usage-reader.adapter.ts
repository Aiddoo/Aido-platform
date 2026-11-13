import { Injectable } from "@nestjs/common";

import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { instantToDate } from "#api/shared/domain/time/instant";

import type { DailySendUsage } from "../../../shared/application/ports/daily-send-usage.reader.port.js";
import type { NudgeUsageReaderPort } from "../../application/ports/nudge-usage.reader.port.js";
import { GetDailyNudgeUsageUseCase } from "../../application/use-cases/get-daily-nudge-usage.use-case.js";

// identity·access가 읽는 공개 모양이라 resetsAt을 Date로 바꿔 준다
@Injectable()
export class NudgeUsageReaderAdapter implements NudgeUsageReaderPort {
  readonly #getDailyNudgeUsage: GetDailyNudgeUsageUseCase;

  constructor(getDailyNudgeUsage: GetDailyNudgeUsageUseCase) {
    this.#getDailyNudgeUsage = getDailyNudgeUsage;
  }

  async readDailyUsage(userId: UserId, timezone: string): Promise<DailySendUsage> {
    const usage = await this.#getDailyNudgeUsage.execute({ userId: userId.value, timezone });
    return { used: usage.used, resetsAt: instantToDate(usage.resetsAt) };
  }
}
