import { Injectable } from "@nestjs/common";

import { TypedConfigService } from "#api/platform/config/services/config.service";

import type { RetentionConfigPort } from "../../application/ports/retention-config.port.js";

@Injectable()
export class RetentionConfigAdapter implements RetentionConfigPort {
  readonly #config: TypedConfigService;

  constructor(config: TypedConfigService) {
    this.#config = config;
  }

  get enabled(): boolean {
    return this.#config.retentionOnboardingV2.enabled;
  }

  get treatmentPercent(): number {
    return this.#config.retentionOnboardingV2.treatmentPercent;
  }
}
