import { type FactoryProvider, Logger } from "@nestjs/common";

import { QUOTA_LEDGER } from "#api/modules/access/access-quota.public";
import { USER_LOCALE_PREFERENCE_READER } from "#api/modules/ai-assistance/parsing/ai-assistance-parsing.public";
import { ACTION_PLAN_GENERATOR } from "#api/modules/ai-assistance/planning/ai-assistance-planning.public";
import { PlanMemoWriterPort } from "#api/modules/notes/memos/notes-memos.public";
import {
  STAGED_TODO_CREATOR,
  type StagedTodoCreatorPort,
  TODO_PLAN_READER,
  type TodoPlanReaderPort,
  toTodoResponse,
} from "#api/modules/planning/todos/planning-todos.public";
import {
  AFTER_COMMIT_TASK_REGISTRY,
  MUTATION_LOCK,
  UNIT_OF_WORK,
} from "#api/shared/application/ports/index";

import { PLAN_APPLICATION_REPOSITORY } from "./action-plans/application/ports/plan-application.repository.port.js";
import {
  QUICK_PLAN_RESULT_REPLAY,
  VOICE_NOTE_DIGEST_RESULT_REPLAY,
} from "./action-plans/application/ports/plan-result-replay.port.js";
import { PLANNING_CONTEXT_READER } from "./action-plans/application/ports/planning-context.reader.port.js";
import { ApplyActionPlanUseCase } from "./action-plans/application/use-cases/apply-action-plan.use-case.js";
import { CreateQuickPlanUseCase } from "./action-plans/application/use-cases/create-quick-plan.use-case.js";
import { PurgePlanApplicationsUseCase } from "./action-plans/application/use-cases/purge-plan-applications.use-case.js";
import { QuotaChargedPlanRunnerAdapter } from "./action-plans/infrastructure/adapters/quota-charged-plan-runner.adapter.js";
import { DigestVoiceNoteUseCase } from "./voice-notes/application/use-cases/digest-voice-note.use-case.js";

type RunnerDependencies = ConstructorParameters<typeof QuotaChargedPlanRunnerAdapter>[0];
type QuickPlanDependencies = ConstructorParameters<typeof CreateQuickPlanUseCase>[0];
type DigestDependencies = ConstructorParameters<typeof DigestVoiceNoteUseCase>[0];
type ApplyDependencies = ConstructorParameters<typeof ApplyActionPlanUseCase>[0];
type PurgeDependencies = ConstructorParameters<typeof PurgePlanApplicationsUseCase>[0];

export const chargedPlanRunnerProvider: FactoryProvider<QuotaChargedPlanRunnerAdapter> = {
  provide: QuotaChargedPlanRunnerAdapter,
  inject: [QUOTA_LEDGER],
  useFactory: (quota: RunnerDependencies["quota"]) =>
    new QuotaChargedPlanRunnerAdapter({
      quota,
      logger: new Logger(QuotaChargedPlanRunnerAdapter.name),
    }),
};

export const createQuickPlanProvider: FactoryProvider<CreateQuickPlanUseCase> = {
  provide: CreateQuickPlanUseCase,
  inject: [
    QuotaChargedPlanRunnerAdapter,
    ACTION_PLAN_GENERATOR,
    PLANNING_CONTEXT_READER,
    USER_LOCALE_PREFERENCE_READER,
    QUICK_PLAN_RESULT_REPLAY,
  ],
  useFactory: (
    runner: QuickPlanDependencies["runner"],
    generator: QuickPlanDependencies["generator"],
    contextReader: QuickPlanDependencies["contextReader"],
    localePreferenceReader: QuickPlanDependencies["localePreferenceReader"],
    replay: QuickPlanDependencies["replay"],
  ) =>
    new CreateQuickPlanUseCase({
      runner,
      generator,
      contextReader,
      localePreferenceReader,
      replay,
      logger: new Logger(CreateQuickPlanUseCase.name),
    }),
};

export const digestVoiceNoteProvider: FactoryProvider<DigestVoiceNoteUseCase> = {
  provide: DigestVoiceNoteUseCase,
  inject: [
    QuotaChargedPlanRunnerAdapter,
    QUOTA_LEDGER,
    ACTION_PLAN_GENERATOR,
    PLANNING_CONTEXT_READER,
    USER_LOCALE_PREFERENCE_READER,
    VOICE_NOTE_DIGEST_RESULT_REPLAY,
  ],
  useFactory: (
    runner: DigestDependencies["runner"],
    quota: DigestDependencies["quota"],
    generator: DigestDependencies["generator"],
    contextReader: DigestDependencies["contextReader"],
    localePreferenceReader: DigestDependencies["localePreferenceReader"],
    replay: DigestDependencies["replay"],
  ) =>
    new DigestVoiceNoteUseCase({
      runner,
      quota,
      generator,
      contextReader,
      localePreferenceReader,
      replay,
      logger: new Logger(DigestVoiceNoteUseCase.name),
    }),
};

export const applyActionPlanProvider: FactoryProvider<ApplyActionPlanUseCase> = {
  provide: ApplyActionPlanUseCase,
  inject: [
    UNIT_OF_WORK,
    MUTATION_LOCK,
    AFTER_COMMIT_TASK_REGISTRY,
    PLAN_APPLICATION_REPOSITORY,
    PLANNING_CONTEXT_READER,
    STAGED_TODO_CREATOR,
    PlanMemoWriterPort,
    TODO_PLAN_READER,
  ],
  useFactory: (
    unitOfWork: ApplyDependencies["unitOfWork"],
    mutationLock: ApplyDependencies["mutationLock"],
    afterCommit: ApplyDependencies["afterCommit"],
    repository: ApplyDependencies["repository"],
    contextReader: ApplyDependencies["contextReader"],
    stagedTodoCreator: StagedTodoCreatorPort,
    memoWriter: ApplyDependencies["memoWriter"],
    todoPlanReader: TodoPlanReaderPort,
  ) =>
    new ApplyActionPlanUseCase({
      unitOfWork,
      mutationLock,
      afterCommit,
      repository,
      contextReader,
      // voice는 아직 계약 Todo를 응답에 그대로 담는다. planning Read Model은 경계에서 계약 모양으로 바꾼다
      todoCreator: {
        stage: async (draft) => {
          const staged = await stagedTodoCreator.stage(draft);
          return { todos: staged.todos.map(toTodoResponse), afterCommit: staged.afterCommit };
        },
      },
      memoWriter,
      todoReader: {
        findManyByIds: async (userId, ids) =>
          (await todoPlanReader.findManyByIds(userId, ids)).map(toTodoResponse),
      },
      logger: new Logger(ApplyActionPlanUseCase.name),
    }),
};

export const purgePlanApplicationsProvider: FactoryProvider<PurgePlanApplicationsUseCase> = {
  provide: PurgePlanApplicationsUseCase,
  inject: [PLAN_APPLICATION_REPOSITORY],
  useFactory: (repository: PurgeDependencies["repository"]) =>
    new PurgePlanApplicationsUseCase({
      repository,
      logger: new Logger(PurgePlanApplicationsUseCase.name),
    }),
};
