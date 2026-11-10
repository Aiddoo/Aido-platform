import { Module } from "@nestjs/common";

import { AccessModule } from "#api/modules/access/access-quota.public";
import {
  AI_DATA_SHARING_CONSENT_READER,
  IdentitySettingsModule,
} from "#api/modules/identity/identity-settings.public";
import { IdentityUserAccessModule } from "#api/modules/identity/identity-user-access.public";
import { NotificationDeliveryModule } from "#api/modules/notification/notification-delivery.public";

import { PlanningCategoriesModule } from "../planning/categories/planning-categories.public.js";
import { PlanningTodosModule } from "../planning/todos/planning-todos.public.js";
import { AiAssistanceGenerationModule } from "./ai-assistance-generation.module.js";
import { AI_PARSING_PROVIDERS } from "./ai-assistance-parsing.providers.js";
import { AI_DATA_SHARING_CONSENT_DECISION_READER } from "./application/ports/parsing/ai-data-sharing-consent.reader.port.js";
import { AI_CLIENT_APP_VERSION_READER } from "./application/ports/parsing/client-app-version.reader.port.js";
import { UPCOMING_TODO_READER } from "./application/ports/parsing/upcoming-todo-reader.port.js";
import { USER_CATEGORY_READER } from "./application/ports/parsing/user-category-reader.port.js";
import { USER_LOCALE_PREFERENCE_READER } from "./application/ports/parsing/user-locale-preference.reader.port.js";
import { LatestClientAppVersionAdapter } from "./infrastructure/adapters/parsing/latest-client-app-version.adapter.js";
import { TodoCategoryReaderAdapter } from "./infrastructure/adapters/parsing/todo-category-reader.adapter.js";
import { UpcomingTodoReaderAdapter } from "./infrastructure/adapters/parsing/upcoming-todo-reader.adapter.js";
import { UserLocalePreferenceReader } from "./infrastructure/adapters/parsing/user-locale-preference.reader.js";
import { AiDataSharingConsentGuard } from "./infrastructure/guards/parsing/ai-data-sharing-consent.guard.js";
import { AiUsageGuard } from "./infrastructure/guards/parsing/ai-usage.guard.js";
import { AiController } from "./presentation/controllers/parsing/v1/ai.controller.js";

@Module({
  imports: [
    AccessModule,
    AiAssistanceGenerationModule,
    IdentitySettingsModule,
    IdentityUserAccessModule,
    NotificationDeliveryModule,
    PlanningCategoriesModule,
    PlanningTodosModule,
  ],
  controllers: [AiController],
  providers: [
    AiUsageGuard,
    AiDataSharingConsentGuard,
    {
      provide: AI_DATA_SHARING_CONSENT_DECISION_READER,
      useExisting: AI_DATA_SHARING_CONSENT_READER,
    },
    { provide: AI_CLIENT_APP_VERSION_READER, useClass: LatestClientAppVersionAdapter },
    { provide: USER_CATEGORY_READER, useClass: TodoCategoryReaderAdapter },
    { provide: USER_LOCALE_PREFERENCE_READER, useClass: UserLocalePreferenceReader },
    { provide: UPCOMING_TODO_READER, useClass: UpcomingTodoReaderAdapter },
    ...AI_PARSING_PROVIDERS,
  ],
  exports: [
    USER_LOCALE_PREFERENCE_READER,
    AI_DATA_SHARING_CONSENT_DECISION_READER,
    AI_CLIENT_APP_VERSION_READER,
    AiDataSharingConsentGuard,
  ],
})
export class AiAssistanceParsingModule {}
