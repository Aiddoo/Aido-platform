import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";

import { PlanApplication } from "../../domain/plan-application.aggregate.js";
import { ActionPlanLogEvent } from "../action-plans.log-events.js";
import type { PlanApplicationRepositoryPort } from "../ports/plan-application.repository.port.js";

interface PurgePlanApplicationsDependencies {
  readonly repository: Pick<PlanApplicationRepositoryPort, "deleteCreatedBefore">;
  readonly clock: ClockPort;
  readonly logger: Pick<ApplicationLoggerPort, "log">;
}

/** 재시도 기간이 지난 적용 멱등 기록을 지운다. */
export class PurgePlanApplicationsUseCase {
  readonly #dependencies: PurgePlanApplicationsDependencies;

  constructor(dependencies: PurgePlanApplicationsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(): Promise<number> {
    const deletedCount = await this.#dependencies.repository.deleteCreatedBefore(
      PlanApplication.retentionCutoff(this.#dependencies.clock.now()),
    );
    this.#dependencies.logger.log({
      event: ActionPlanLogEvent.PLAN_APPLICATION_PURGED,
      deletedCount,
    });
    return deletedCount;
  }
}
