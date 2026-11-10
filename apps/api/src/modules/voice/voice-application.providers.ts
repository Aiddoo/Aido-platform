import { type FactoryProvider, Logger } from "@nestjs/common";

import { QUOTA_LEDGER } from "#api/modules/access/access-quota.public";
import { USER_LOCALE_PREFERENCE_READER } from "#api/modules/ai-assistance/ai-assistance-parsing.public";
import { ACTION_PLAN_GENERATOR } from "#api/modules/ai-assistance/ai-assistance-planning.public";
import { PLAN_MEMO_WRITER } from "#api/modules/notes/memos/notes-memos.public";
import { STAGED_TODO_CREATOR, TODO_PLAN_READER } from "#api/modules/planning/planning-todos.public";
import {
  AFTER_COMMIT_TASK_REGISTRY,
  MUTATION_LOCK,
  UNIT_OF_WORK,
} from "#api/shared/application/ports/index";

import { PLAN_APPLICATION_REPOSITORY } from "./application/ports/plans/plan-application.repository.port.js";
import {
  QUICK_PLAN_RESULT_REPLAY,
  VOICE_NOTE_DIGEST_RESULT_REPLAY,
} from "./application/ports/plans/plan-result-replay.port.js";
import { PLANNING_CONTEXT_READER } from "./application/ports/plans/planning-context.reader.port.js";
import { ChargedPlanRunner } from "./application/services/plans/charged-plan-runner.js";
import { DigestVoiceNote } from "./application/use-cases/notes/digest-voice-note.use-case.js";
import { ApplyActionPlan } from "./application/use-cases/plans/apply-action-plan.use-case.js";
import { PurgePlanApplications } from "./application/use-cases/plans/purge-plan-applications.use-case.js";
import { CreateQuickPlan } from "./application/use-cases/quick-plans/create-quick-plan.use-case.js";

type RunnerDependencies = ConstructorParameters<typeof ChargedPlanRunner>[0];
type QuickPlanDependencies = ConstructorParameters<typeof CreateQuickPlan>[0];
type DigestDependencies = ConstructorParameters<typeof DigestVoiceNote>[0];
type ApplyDependencies = ConstructorParameters<typeof ApplyActionPlan>[0];
type PurgeDependencies = ConstructorParameters<typeof PurgePlanApplications>[0];

export const chargedPlanRunnerProvider: FactoryProvider<ChargedPlanRunner> = {
  provide: ChargedPlanRunner,
  inject: [QUOTA_LEDGER],
  useFactory: (quota: RunnerDependencies["quota"]) =>
    new ChargedPlanRunner({ quota, logger: new Logger(ChargedPlanRunner.name) }),
};

export const createQuickPlanProvider: FactoryProvider<CreateQuickPlan> = {
  provide: CreateQuickPlan,
  inject: [
    ChargedPlanRunner,
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
    new CreateQuickPlan({
      runner,
      generator,
      contextReader,
      localePreferenceReader,
      replay,
      logger: new Logger(CreateQuickPlan.name),
    }),
};

export const digestVoiceNoteProvider: FactoryProvider<DigestVoiceNote> = {
  provide: DigestVoiceNote,
  inject: [
    ChargedPlanRunner,
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
    new DigestVoiceNote({
      runner,
      quota,
      generator,
      contextReader,
      localePreferenceReader,
      replay,
      logger: new Logger(DigestVoiceNote.name),
    }),
};

export const applyActionPlanProvider: FactoryProvider<ApplyActionPlan> = {
  provide: ApplyActionPlan,
  inject: [
    UNIT_OF_WORK,
    MUTATION_LOCK,
    AFTER_COMMIT_TASK_REGISTRY,
    PLAN_APPLICATION_REPOSITORY,
    PLANNING_CONTEXT_READER,
    STAGED_TODO_CREATOR,
    PLAN_MEMO_WRITER,
    TODO_PLAN_READER,
  ],
  useFactory: (
    unitOfWork: ApplyDependencies["unitOfWork"],
    mutationLock: ApplyDependencies["mutationLock"],
    afterCommit: ApplyDependencies["afterCommit"],
    repository: ApplyDependencies["repository"],
    contextReader: ApplyDependencies["contextReader"],
    todoCreator: ApplyDependencies["todoCreator"],
    memoWriter: ApplyDependencies["memoWriter"],
    todoReader: ApplyDependencies["todoReader"],
  ) =>
    new ApplyActionPlan({
      unitOfWork,
      mutationLock,
      afterCommit,
      repository,
      contextReader,
      todoCreator,
      memoWriter,
      todoReader,
      logger: new Logger(ApplyActionPlan.name),
    }),
};

export const purgePlanApplicationsProvider: FactoryProvider<PurgePlanApplications> = {
  provide: PurgePlanApplications,
  inject: [PLAN_APPLICATION_REPOSITORY],
  useFactory: (repository: PurgeDependencies["repository"]) =>
    new PurgePlanApplications({ repository, logger: new Logger(PurgePlanApplications.name) }),
};
