import { type FactoryProvider, Logger } from "@nestjs/common";

import { AI_DATA_SHARING_CONSENT_READER } from "#api/modules/identity/identity-settings.public";

import { AI_GENERATOR } from "./application/ports/generation/ai-generator.port.js";
import { ActionPlanGenerator } from "./application/services/planning/action-plan-generator.service.js";

type ActionPlanGeneratorDependencies = ConstructorParameters<typeof ActionPlanGenerator>[0];

export const actionPlanGeneratorProvider: FactoryProvider<ActionPlanGenerator> = {
  provide: ActionPlanGenerator,
  inject: [AI_GENERATOR, AI_DATA_SHARING_CONSENT_READER],
  useFactory: (
    generator: ActionPlanGeneratorDependencies["generator"],
    consentReader: ActionPlanGeneratorDependencies["consentReader"],
  ) =>
    new ActionPlanGenerator({
      generator,
      consentReader,
      logger: new Logger(ActionPlanGenerator.name),
    }),
};
