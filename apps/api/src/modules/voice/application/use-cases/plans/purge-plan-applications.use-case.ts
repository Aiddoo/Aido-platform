import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import { subtractDays } from "#api/shared/domain/date/utils/arithmetic";

import { PLAN_APPLICATION_RETENTION_DAYS } from "../../../domain/constants/plans/plan-application.constants.js";
import { VoiceLogEvent } from "../../observability/plans/voice-log.events.js";
import type { PlanApplicationRepositoryPort } from "../../ports/plans/plan-application.repository.port.js";

interface PurgePlanApplicationsDependencies {
  readonly repository: Pick<PlanApplicationRepositoryPort, "deleteCreatedBefore">;
  readonly logger: Pick<ApplicationLoggerPort, "log">;
}

/** 재시도 기간이 지난 적용 멱등 기록을 지운다. */
export class PurgePlanApplications {
  readonly #dependencies: PurgePlanApplicationsDependencies;

  constructor(dependencies: PurgePlanApplicationsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(): Promise<number> {
    const deletedCount = await this.#dependencies.repository.deleteCreatedBefore(
      subtractDays(PLAN_APPLICATION_RETENTION_DAYS),
    );
    this.#dependencies.logger.log({ event: VoiceLogEvent.PLAN_APPLICATION_PURGED, deletedCount });
    return deletedCount;
  }
}
