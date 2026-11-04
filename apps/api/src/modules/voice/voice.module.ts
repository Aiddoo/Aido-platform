import { quickPlanResponseSchema, voiceNoteDigestResponseSchema } from "@aido/api";
import { Module, type Provider } from "@nestjs/common";

import { AccessModule } from "#api/modules/access/access-quota.public";
import { AiAssistanceParsingModule } from "#api/modules/ai-assistance/ai-assistance-parsing.public";
import { AiAssistancePlanningModule } from "#api/modules/ai-assistance/ai-assistance-planning.public";
import { NotesMemosModule } from "#api/modules/notes/notes-memos.public";
import { PlanningCategoriesModule } from "#api/modules/planning/planning-categories.public";
import { PlanningTodosModule } from "#api/modules/planning/planning-todos.public";
import { InMemoryCacheAdapter } from "#api/platform/cache/adapters/in-memory-cache.adapter";

import { PLAN_APPLICATION_REPOSITORY } from "./application/ports/plans/plan-application.repository.port.js";
import {
  QUICK_PLAN_RESULT_REPLAY,
  VOICE_NOTE_DIGEST_RESULT_REPLAY,
} from "./application/ports/plans/plan-result-replay.port.js";
import { PLANNING_CONTEXT_READER } from "./application/ports/plans/planning-context.reader.port.js";
import {
  InMemoryPlanResultReplay,
  PLAN_RESULT_REPLAY_MAX_ITEMS,
  PLAN_RESULT_REPLAY_TTL_MS,
} from "./infrastructure/adapters/plans/in-memory-plan-result-replay.js";
import { PlanningContextReader } from "./infrastructure/adapters/plans/planning-context.reader.js";
import { PlanApplicationCleanupJob } from "./infrastructure/jobs/plans/plan-application-cleanup.job.js";
import { PlanApplicationCleanupProcessor } from "./infrastructure/jobs/plans/plan-application-cleanup.processor.js";
import { DrizzlePlanApplicationRepository } from "./infrastructure/persistence/plans/drizzle-plan-application.repository.js";
import { ActionPlanController } from "./presentation/controllers/action-plans/v1/action-plan.controller.js";
import { QuickPlanController } from "./presentation/controllers/quick-plans/v1/quick-plan.controller.js";
import { VoiceNoteController } from "./presentation/controllers/voice-notes/v1/voice-note.controller.js";
import {
  applyActionPlanProvider,
  chargedPlanRunnerProvider,
  createQuickPlanProvider,
  digestVoiceNoteProvider,
  purgePlanApplicationsProvider,
} from "./voice-application.providers.js";
import { PLAN_RESULT_CACHE } from "./voice.constants.js";

const replayProviders: Provider[] = [
  {
    provide: PLAN_RESULT_CACHE,
    useFactory: () =>
      new InMemoryCacheAdapter({
        defaultTtlMs: PLAN_RESULT_REPLAY_TTL_MS,
        maxItems: PLAN_RESULT_REPLAY_MAX_ITEMS,
      }),
  },
  {
    provide: QUICK_PLAN_RESULT_REPLAY,
    inject: [PLAN_RESULT_CACHE],
    useFactory: (cache: InMemoryCacheAdapter) =>
      new InMemoryPlanResultReplay(
        cache,
        "quick-plan",
        quickPlanResponseSchema.pick({ plan: true, meta: true }),
      ),
  },
  {
    provide: VOICE_NOTE_DIGEST_RESULT_REPLAY,
    inject: [PLAN_RESULT_CACHE],
    useFactory: (cache: InMemoryCacheAdapter) =>
      new InMemoryPlanResultReplay(
        cache,
        "voice-note-digest",
        voiceNoteDigestResponseSchema.omit({ featureQuota: true, charged: true }),
      ),
  },
];

/** 빠른 계획·녹음 정리·계획 적용. 서버는 녹음도 전사 글자도 저장하지 않고 사용량과 멱등 기록만 남긴다. */
@Module({
  imports: [
    AccessModule,
    AiAssistanceParsingModule,
    AiAssistancePlanningModule,
    NotesMemosModule,
    PlanningCategoriesModule,
    PlanningTodosModule,
  ],
  controllers: [QuickPlanController, VoiceNoteController, ActionPlanController],
  providers: [
    { provide: PLANNING_CONTEXT_READER, useClass: PlanningContextReader },
    { provide: PLAN_APPLICATION_REPOSITORY, useClass: DrizzlePlanApplicationRepository },
    ...replayProviders,
    chargedPlanRunnerProvider,
    createQuickPlanProvider,
    digestVoiceNoteProvider,
    applyActionPlanProvider,
    purgePlanApplicationsProvider,
    PlanApplicationCleanupJob,
    PlanApplicationCleanupProcessor,
  ],
})
export class VoiceModule {}
