import { now } from "#api/shared/domain/date/utils/core";

import {
  type PremiumAccess,
  resolvePremiumAccess,
} from "../../../shared/premium-access.domain-service.js";
import type { PremiumAccessReaderPort } from "../ports/premium-access.reader.port.js";
import type { PremiumGrantRepositoryPort } from "../ports/premium-grant.repository.port.js";
import type { ProjectPremiumAccessUseCase } from "./project-premium-access.use-case.js";

interface PremiumAccessReaderDependencies {
  readonly premiumAccessProjector: Pick<ProjectPremiumAccessUseCase, "loadEntitlements">;
  readonly premiumGrantRepository: Pick<PremiumGrantRepositoryPort, "findLastEndedAt">;
}

export class GetPremiumAccessUseCase implements PremiumAccessReaderPort {
  readonly #dependencies: PremiumAccessReaderDependencies;

  constructor(dependencies: PremiumAccessReaderDependencies) {
    this.#dependencies = dependencies;
  }

  async getPremiumAccess(userId: string): Promise<PremiumAccess> {
    const [{ entitlements }, lastEndedGrantAt] = await Promise.all([
      this.#dependencies.premiumAccessProjector.loadEntitlements(userId),
      this.#dependencies.premiumGrantRepository.findLastEndedAt(userId),
    ]);
    return resolvePremiumAccess({ ...entitlements, lastEndedGrantAt }, now());
  }
}
