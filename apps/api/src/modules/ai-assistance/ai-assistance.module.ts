import { Module } from "@nestjs/common";

import { AiAssistanceGenerationModule } from "./generation/ai-assistance-generation.module.js";
import { AiAssistanceParsingModule } from "./parsing/ai-assistance-parsing.module.js";
import { AiAssistancePlanningModule } from "./planning/ai-assistance-planning.module.js";
import { AiAssistanceReportsModule } from "./reports/ai-assistance-reports.module.js";
import { AiAssistanceSuggestionsModule } from "./suggestions/ai-assistance-suggestions.module.js";

@Module({
  imports: [
    AiAssistanceGenerationModule,
    AiAssistanceParsingModule,
    AiAssistancePlanningModule,
    AiAssistanceReportsModule,
    AiAssistanceSuggestionsModule,
  ],
  exports: [AiAssistanceGenerationModule, AiAssistanceParsingModule, AiAssistancePlanningModule],
})
export class AiAssistanceModule {}
