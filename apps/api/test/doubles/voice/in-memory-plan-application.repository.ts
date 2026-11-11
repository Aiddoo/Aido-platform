import { planApplicationInProgress } from "#api/modules/voice/action-plans/application/action-plans.errors";
import { PlanApplicationRepositoryPort } from "#api/modules/voice/action-plans/application/ports/plan-application.repository.port";
import { PlanApplication } from "#api/modules/voice/action-plans/domain/plan-application.aggregate";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

function copyOf(application: PlanApplication): PlanApplication {
  return PlanApplication.reconstitute(application.toPrimitives());
}

export class InMemoryPlanApplicationRepository extends PlanApplicationRepositoryPort {
  readonly #applications = new Map<string, PlanApplication>();

  get saved(): readonly PlanApplication[] {
    return [...this.#applications.values()].map(copyOf);
  }

  async findByIdempotencyKey(
    userId: UserId,
    idempotencyKey: string,
  ): Promise<PlanApplication | null> {
    const found = [...this.#applications.values()].find((application) => {
      const primitives = application.toPrimitives();
      return primitives.userId === userId.value && primitives.idempotencyKey === idempotencyKey;
    });
    return found == null ? null : copyOf(found);
  }

  async save(application: PlanApplication): Promise<void> {
    const primitives = application.toPrimitives();
    if (this.#applications.has(primitives.id)) {
      return;
    }
    const sameKey = await this.findByIdempotencyKey(application.userId, primitives.idempotencyKey);
    if (sameKey != null) {
      throw planApplicationInProgress();
    }
    this.#applications.set(primitives.id, copyOf(application));
  }

  async deleteCreatedBefore(cutoff: Temporal.Instant): Promise<number> {
    let deleted = 0;
    for (const [id, application] of this.#applications) {
      if (Temporal.Instant.compare(application.toPrimitives().createdAt, cutoff) < 0) {
        this.#applications.delete(id);
        deleted += 1;
      }
    }
    return deleted;
  }
}
