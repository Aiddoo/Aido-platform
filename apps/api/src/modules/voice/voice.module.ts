import { quickPlanResponseSchema, voiceNoteDigestResponseSchema } from "@aido/api";
import { Module, type Provider } from "@nestjs/common";
import { z } from "zod";

import { AccessModule } from "#api/modules/access/access-quota.public";
import { AiAssistanceParsingModule } from "#api/modules/ai-assistance/parsing/ai-assistance-parsing.public";
import { AiAssistancePlanningModule } from "#api/modules/ai-assistance/planning/ai-assistance-planning.public";
import { NotesMemosModule } from "#api/modules/notes/memos/notes-memos.public";
import { PlanningCategoriesModule } from "#api/modules/planning/categories/planning-categories.public";
import { PlanningTodosModule } from "#api/modules/planning/todos/planning-todos.public";
import { InMemoryCacheStore } from "#api/platform/cache/adapters/in-memory-cache.store";

import { PLAN_APPLICATION_REPOSITORY } from "./action-plans/application/ports/plan-application.repository.port.js";
import {
  QUICK_PLAN_RESULT_REPLAY,
  VOICE_NOTE_DIGEST_RESULT_REPLAY,
} from "./action-plans/application/ports/plan-result-replay.port.js";
import { PLANNING_CONTEXT_READER } from "./action-plans/application/ports/planning-context.reader.port.js";
import {
  InMemoryPlanResultReplayAdapter,
  PLAN_RESULT_REPLAY_MAX_ITEMS,
  PLAN_RESULT_REPLAY_TTL_MS,
} from "./action-plans/infrastructure/adapters/in-memory-plan-result-replay.adapter.js";
import { PlanningContextReader } from "./action-plans/infrastructure/adapters/planning-context-reader.adapter.js";
import { PlanApplicationCleanupProcessor } from "./action-plans/infrastructure/jobs/plan-application-cleanup.processor.js";
import { PlanApplicationCleanupJob } from "./action-plans/infrastructure/jobs/plan-application-cleanup.scheduler.js";
import { DrizzlePlanApplicationRepository } from "./action-plans/infrastructure/persistence/drizzle-plan-application.repository.js";
import { ActionPlanController } from "./action-plans/presentation/http/v1/action-plan.controller.js";
import { QuickPlanController } from "./action-plans/presentation/http/v1/quick-plan.controller.js";
import {
  applyActionPlanProvider,
  chargedPlanRunnerProvider,
  createQuickPlanProvider,
  digestVoiceNoteProvider,
  purgePlanApplicationsProvider,
} from "./voice-application.providers.js";
import { VoiceNoteController } from "./voice-notes/presentation/http/v1/voice-note.controller.js";
import { PLAN_RESULT_CACHE } from "./voice.constants.js";

const replayProviders: Provider[] = [
  {
    provide: PLAN_RESULT_CACHE,
    useFactory: () =>
      new InMemoryCacheStore({
        defaultTtlMs: PLAN_RESULT_REPLAY_TTL_MS,
        maxItems: PLAN_RESULT_REPLAY_MAX_ITEMS,
      }),
  },
  {
    provide: QUICK_PLAN_RESULT_REPLAY,
    inject: [PLAN_RESULT_CACHE],
    useFactory: (cache: InMemoryCacheStore) =>
      new InMemoryPlanResultReplayAdapter(
        cache,
        "quick-plan",
        quickPlanResponseSchema.pick({ plan: true }).extend({ model: z.string() }),
      ),
  },
  {
    provide: VOICE_NOTE_DIGEST_RESULT_REPLAY,
    inject: [PLAN_RESULT_CACHE],
    useFactory: (cache: InMemoryCacheStore) =>
      new InMemoryPlanResultReplayAdapter(
        cache,
        "voice-note-digest",
        voiceNoteDigestResponseSchema
          .omit({ featureQuota: true, charged: true })
          .extend({ model: z.string() }),
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
