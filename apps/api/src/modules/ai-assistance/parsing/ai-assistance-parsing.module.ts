import { Module } from "@nestjs/common";

import { AccessModule } from "#api/modules/access/access-quota.public";
import {
  AI_DATA_SHARING_CONSENT_READER,
  IdentitySettingsModule,
} from "#api/modules/identity/identity-settings.public";
import { IdentityUserAccessModule } from "#api/modules/identity/identity-user-access.public";
import { NotificationDeliveryModule } from "#api/modules/notification/notification-delivery.public";
import { PlanningCategoriesModule } from "#api/modules/planning/categories/planning-categories.public";
import { PlanningTodosModule } from "#api/modules/planning/todos/planning-todos.public";

import { AiAssistanceGenerationModule } from "../generation/ai-assistance-generation.module.js";
import { AI_DATA_SHARING_CONSENT_DECISION_READER } from "../generation/application/ports/ai-data-sharing-consent.reader.port.js";
import { AI_CLIENT_APP_VERSION_READER } from "../generation/application/ports/client-app-version.reader.port.js";
import { USER_LOCALE_PREFERENCE_READER } from "../generation/application/ports/user-locale-preference.reader.port.js";
import { LatestClientAppVersionAdapter } from "../generation/infrastructure/adapters/latest-client-app-version.adapter.js";
import { UserLocalePreferenceReaderAdapter } from "../generation/infrastructure/adapters/user-locale-preference-reader.adapter.js";
import { AI_PARSING_PROVIDERS } from "./ai-assistance-parsing.providers.js";
import { UPCOMING_TODO_READER } from "./application/ports/upcoming-todo.reader.port.js";
import { USER_CATEGORY_READER } from "./application/ports/user-category.reader.port.js";
import { TodoCategoryReaderAdapter } from "./infrastructure/adapters/todo-category-reader.adapter.js";
import { UpcomingTodoReaderAdapter } from "./infrastructure/adapters/upcoming-todo-reader.adapter.js";
import { AiDataSharingConsentGuard } from "./presentation/http/guards/ai-data-sharing-consent.guard.js";
import { AiUsageGuard } from "./presentation/http/guards/ai-usage.guard.js";
import { AiController } from "./presentation/http/v1/ai.controller.js";

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
    { provide: USER_LOCALE_PREFERENCE_READER, useClass: UserLocalePreferenceReaderAdapter },
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
