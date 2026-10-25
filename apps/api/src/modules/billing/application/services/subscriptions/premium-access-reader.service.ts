import { now } from "#api/shared/domain/date/utils/core";

import {
  type PremiumAccess,
  PremiumAccessPolicy,
} from "../../../domain/policies/subscriptions/premium-access.policy.js";
import type { PremiumAccessReaderPort } from "../../ports/subscriptions/premium-access.reader.port.js";
import type { PremiumGrantRepositoryPort } from "../../ports/subscriptions/premium-grant.repository.port.js";
import type { PremiumAccessProjector } from "./premium-access-projector.service.js";

interface PremiumAccessReaderDependencies {
  readonly premiumAccessProjector: Pick<PremiumAccessProjector, "loadEntitlements">;
  readonly premiumGrantRepository: Pick<PremiumGrantRepositoryPort, "findLastEndedAt">;
}

export class PremiumAccessReader implements PremiumAccessReaderPort {
  readonly #dependencies: PremiumAccessReaderDependencies;

  constructor(dependencies: PremiumAccessReaderDependencies) {
    this.#dependencies = dependencies;
  }

  async getPremiumAccess(userId: string): Promise<PremiumAccess> {
    const [{ entitlements }, lastEndedGrantAt] = await Promise.all([
      this.#dependencies.premiumAccessProjector.loadEntitlements(userId),
      this.#dependencies.premiumGrantRepository.findLastEndedAt(userId),
    ]);
    return PremiumAccessPolicy.resolve({ ...entitlements, lastEndedGrantAt }, now());
  }
}
