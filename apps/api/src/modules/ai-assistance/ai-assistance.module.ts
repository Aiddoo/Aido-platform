import { Module } from "@nestjs/common";

import { AiAssistanceActionPlanDraftsModule } from "./action-plan-drafts/ai-assistance-action-plan-drafts.module.js";
import { AiAssistanceAiGenerationsModule } from "./ai-generations/ai-assistance-ai-generations.module.js";
import { AiAssistanceAiReportsModule } from "./ai-reports/ai-assistance-ai-reports.module.js";
import { AiAssistanceParsedDraftsModule } from "./parsed-drafts/ai-assistance-parsed-drafts.module.js";
import { AiAssistanceSuggestionsModule } from "./suggestions/ai-assistance-suggestions.module.js";

@Module({
  imports: [
    AiAssistanceAiGenerationsModule,
    AiAssistanceParsedDraftsModule,
    AiAssistanceActionPlanDraftsModule,
    AiAssistanceAiReportsModule,
    AiAssistanceSuggestionsModule,
  ],
  exports: [
    AiAssistanceAiGenerationsModule,
    AiAssistanceParsedDraftsModule,
    AiAssistanceActionPlanDraftsModule,
  ],
})
export class AiAssistanceModule {}
