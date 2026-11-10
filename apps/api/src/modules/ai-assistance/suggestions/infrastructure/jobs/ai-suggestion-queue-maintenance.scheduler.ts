import { Injectable, Logger } from "@nestjs/common";

import { AiJobLogEvent } from "../../../reports/infrastructure/jobs/ai-job.log-events.js";

/** AI 제안 큐의 완료된 실패 기록만 보존 정책에 맞춰 정리한다. */
@Injectable()
export class AiSuggestionQueueMaintenanceService {
  readonly #logger = new Logger(AiSuggestionQueueMaintenanceService.name);

  async cleanExpiredFailures(): Promise<number> {
    this.#logger.debug({ event: AiJobLogEvent.FAILURE_RETENTION_DELEGATED });
    return 0;
  }
}
