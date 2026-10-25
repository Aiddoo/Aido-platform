import { now } from "#api/shared/domain/date/utils/core";

import {
  type PremiumAccess,
  PremiumAccessPolicy,
} from "../../../domain/policies/subscriptions/premium-access.policy.js";
import type { PremiumAccessReaderPort } from "../../ports/subscriptions/premium-access.reader.port.js";
import type { PremiumAccessProjector } from "./premium-access-projector.service.js";

interface PremiumAccessReaderDependencies {
  readonly premiumAccessProjector: Pick<PremiumAccessProjector, "loadEntitlements">;
}

export class PremiumAccessReader implements PremiumAccessReaderPort {
  readonly #dependencies: PremiumAccessReaderDependencies;

  constructor(dependencies: PremiumAccessReaderDependencies) {
    this.#dependencies = dependencies;
  }

  async getPremiumAccess(userId: string): Promise<PremiumAccess> {
    const { entitlements } =
      await this.#dependencies.premiumAccessProjector.loadEntitlements(userId);
    return PremiumAccessPolicy.resolve(entitlements, now());
  }
}
