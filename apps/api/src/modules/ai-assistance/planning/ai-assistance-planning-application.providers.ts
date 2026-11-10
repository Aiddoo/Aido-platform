import { type FactoryProvider, Logger } from "@nestjs/common";

import { AI_DATA_SHARING_CONSENT_READER } from "#api/modules/identity/identity-settings.public";

import { AI_GENERATOR } from "../generation/application/ports/ai-generator.port.js";
import { AiActionPlanGeneratorAdapter } from "./infrastructure/adapters/ai-action-plan-generator.adapter.js";

type ActionPlanGeneratorDependencies = ConstructorParameters<
  typeof AiActionPlanGeneratorAdapter
>[0];

export const actionPlanGeneratorProvider: FactoryProvider<AiActionPlanGeneratorAdapter> = {
  provide: AiActionPlanGeneratorAdapter,
  inject: [AI_GENERATOR, AI_DATA_SHARING_CONSENT_READER],
  useFactory: (
    generator: ActionPlanGeneratorDependencies["generator"],
    consentReader: ActionPlanGeneratorDependencies["consentReader"],
  ) =>
    new AiActionPlanGeneratorAdapter({
      generator,
      consentReader,
      logger: new Logger(AiActionPlanGeneratorAdapter.name),
    }),
};
