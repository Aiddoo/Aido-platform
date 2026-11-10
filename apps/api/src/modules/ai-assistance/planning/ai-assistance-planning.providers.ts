import type { Provider } from "@nestjs/common";

import { AiDataSharingConsentReaderPort } from "#api/modules/identity/identity-settings.public";
import { loggerFor, provideUseCase } from "#api/platform/di/provide-use-case";
import { ClockPort } from "#api/shared/application/ports/clock.port";

import { AiGeneratorPort } from "../generation/application/ports/ai-generator.port.js";
import {
  ACTION_PLAN_GENERATOR,
  ActionPlanGeneratorPort,
} from "./application/ports/action-plan-generator.port.js";
import { AiActionPlanGeneratorAdapter } from "./infrastructure/adapters/ai-action-plan-generator.adapter.js";

export const AI_ASSISTANCE_PLANNING_PROVIDERS = [
  provideUseCase(AiActionPlanGeneratorAdapter, {
    generator: AiGeneratorPort,
    consentReader: AiDataSharingConsentReaderPort,
    clock: ClockPort,
    logger: loggerFor(AiActionPlanGeneratorAdapter),
  }),
  { provide: ActionPlanGeneratorPort, useExisting: AiActionPlanGeneratorAdapter },
  { provide: ACTION_PLAN_GENERATOR, useExisting: ActionPlanGeneratorPort },
] satisfies Provider[];
