import { quickPlanResponseSchema } from "@aido/api";
import type { FactoryProvider, Provider } from "@nestjs/common";
import { z } from "zod";

import { QuotaLedgerPort } from "#api/modules/access/quotas/access-quotas.public";
import { UserLocalePreferenceReaderPort } from "#api/modules/ai-assistance/generation/ai-assistance-generation.public";
import { ChargedGenerationPort } from "#api/modules/ai-assistance/parsing/ai-assistance-parsing.public";
import { ActionPlanGeneratorPort } from "#api/modules/ai-assistance/planning/ai-assistance-planning.public";
import { PlanMemoWriterPort } from "#api/modules/notes/memos/notes-memos.public";
import {
  StagedTodoCreatorPort,
  TodoPlanReaderPort,
} from "#api/modules/planning/todos/planning-todos.public";
import { loggerFor, provideUseCase } from "#api/platform/di/provide-use-case";
import { AfterCommitTaskRegistryPort } from "#api/shared/application/ports/after-commit-task.registry.port";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";

import { ChargedPlanRunnerPort } from "./application/ports/charged-plan-runner.port.js";
import { PlanApplicationRepositoryPort } from "./application/ports/plan-application.repository.port.js";
import { QuickPlanResultReplayPort } from "./application/ports/plan-result-replay.port.js";
import { PlanningContextReaderPort } from "./application/ports/planning-context.reader.port.js";
import { ApplyActionPlanUseCase } from "./application/use-cases/apply-action-plan.use-case.js";
import { CreateQuickPlanUseCase } from "./application/use-cases/create-quick-plan.use-case.js";
import { PurgePlanApplicationsUseCase } from "./application/use-cases/purge-plan-applications.use-case.js";
import {
  InMemoryPlanResultReplayAdapter,
  PlanResultReplayCache,
} from "./infrastructure/adapters/in-memory-plan-result-replay.adapter.js";
import { PlanningContextReaderAdapter } from "./infrastructure/adapters/planning-context-reader.adapter.js";
import { QuotaChargedPlanRunnerAdapter } from "./infrastructure/adapters/quota-charged-plan-runner.adapter.js";
import { PlanApplicationCleanupProcessor } from "./infrastructure/jobs/plan-application-cleanup.processor.js";
import { PlanApplicationCleanupScheduler } from "./infrastructure/jobs/plan-application-cleanup.scheduler.js";
import { DrizzlePlanApplicationRepository } from "./infrastructure/persistence/drizzle-plan-application.repository.js";

const quickPlanResultReplayProvider: FactoryProvider<QuickPlanResultReplayPort> = {
  provide: QuickPlanResultReplayPort,
  inject: [PlanResultReplayCache],
  useFactory: (cache: PlanResultReplayCache) =>
    new InMemoryPlanResultReplayAdapter(
      cache,
      "quick-plan",
      quickPlanResponseSchema.pick({ plan: true }).extend({ model: z.string() }),
    ),
};

const chargedPlanRunnerProvider: FactoryProvider<ChargedPlanRunnerPort> = {
  provide: ChargedPlanRunnerPort,
  inject: [QuotaLedgerPort, ChargedGenerationPort],
  useFactory: (quota: QuotaLedgerPort, chargedGeneration: ChargedGenerationPort) =>
    new QuotaChargedPlanRunnerAdapter({ quota, chargedGeneration }),
};

export const VOICE_ACTION_PLANS_PROVIDERS = [
  { provide: PlanningContextReaderPort, useClass: PlanningContextReaderAdapter },
  { provide: PlanApplicationRepositoryPort, useClass: DrizzlePlanApplicationRepository },
  PlanResultReplayCache,
  quickPlanResultReplayProvider,
  chargedPlanRunnerProvider,
  provideUseCase(CreateQuickPlanUseCase, {
    runner: ChargedPlanRunnerPort,
    generator: ActionPlanGeneratorPort,
    contextReader: PlanningContextReaderPort,
    localePreferenceReader: UserLocalePreferenceReaderPort,
    replay: QuickPlanResultReplayPort,
    clock: ClockPort,
    logger: loggerFor(CreateQuickPlanUseCase),
  }),
  provideUseCase(ApplyActionPlanUseCase, {
    unitOfWork: UnitOfWorkPort,
    mutationLock: MutationLockPort,
    afterCommit: AfterCommitTaskRegistryPort,
    repository: PlanApplicationRepositoryPort,
    contextReader: PlanningContextReaderPort,
    todoCreator: StagedTodoCreatorPort,
    todoReader: TodoPlanReaderPort,
    memoWriter: PlanMemoWriterPort,
    clock: ClockPort,
    logger: loggerFor(ApplyActionPlanUseCase),
  }),
  provideUseCase(PurgePlanApplicationsUseCase, {
    repository: PlanApplicationRepositoryPort,
    clock: ClockPort,
    logger: loggerFor(PurgePlanApplicationsUseCase),
  }),
  PlanApplicationCleanupScheduler,
  PlanApplicationCleanupProcessor,
] satisfies Provider[];
