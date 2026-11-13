import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";

import { planApplicationRetentionCutoff } from "../../domain/plan-application-retention.domain-service.js";
import { ActionPlanLogEvent } from "../action-plans.log-events.js";
import type { PlanApplicationRepositoryPort } from "../ports/plan-application.repository.port.js";

interface PurgePlanApplicationsDependencies {
  readonly planApplicationRepository: Pick<PlanApplicationRepositoryPort, "purgeCreatedBefore">;
  readonly clock: ClockPort;
  readonly logger: Pick<ApplicationLoggerPort, "log">;
}

/** 재시도 기간이 지난 적용 멱등 기록을 지운다 */
export class PurgePlanApplicationsUseCase {
  readonly #dependencies: PurgePlanApplicationsDependencies;

  constructor(dependencies: PurgePlanApplicationsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(): Promise<number> {
    const { planApplicationRepository, clock, logger } = this.#dependencies;

    const purgedCount = await planApplicationRepository.purgeCreatedBefore(
      planApplicationRetentionCutoff(clock.now()),
    );

    logger.log({ event: ActionPlanLogEvent.PLAN_APPLICATION_PURGED, deletedCount: purgedCount });
    return purgedCount;
  }
}
