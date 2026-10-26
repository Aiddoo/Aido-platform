import { Module } from "@nestjs/common";

import { AccessModule, AI_QUOTA as ACCESS_AI_QUOTA } from "#api/modules/access/access-quota.public";
import {
  AI_DATA_SHARING_CONSENT_READER,
  IdentitySettingsModule,
} from "#api/modules/identity/identity-settings.public";
import { IdentityUserAccessModule } from "#api/modules/identity/identity-user-access.public";
import { NotificationDeliveryModule } from "#api/modules/notification/notification-delivery.public";

import { PlanningCategoriesModule } from "../planning/planning-categories.public.js";
import { AI_PROVIDERS } from "./ai-assistance-parsing.providers.js";
import { AI_DATA_SHARING_CONSENT_DECISION_READER } from "./application/ports/parsing/ai-data-sharing-consent.reader.port.js";
import { AI_PROVIDER } from "./application/ports/parsing/ai-provider.port.js";
import { AI_QUOTA } from "./application/ports/parsing/ai-quota.port.js";
import { AI_TASK_SETTINGS } from "./application/ports/parsing/ai-task-settings.port.js";
import { AI_CLIENT_APP_VERSION_READER } from "./application/ports/parsing/client-app-version.reader.port.js";
import { USER_CATEGORY_READER } from "./application/ports/parsing/user-category-reader.port.js";
import { USER_LOCALE_PREFERENCE_READER } from "./application/ports/parsing/user-locale-preference.reader.port.js";
import { GeminiAiAdapter } from "./infrastructure/adapters/parsing/gemini-ai.adapter.js";
import { LatestClientAppVersionAdapter } from "./infrastructure/adapters/parsing/latest-client-app-version.adapter.js";
import { TodoCategoryReaderAdapter } from "./infrastructure/adapters/parsing/todo-category-reader.adapter.js";
import { UserLocalePreferenceReader } from "./infrastructure/adapters/parsing/user-locale-preference.reader.js";
import { aiTaskSettingsProvider } from "./infrastructure/config/parsing/ai-task-config.js";
import { AiDataSharingConsentGuard } from "./infrastructure/guards/parsing/ai-data-sharing-consent.guard.js";
import { AiUsageGuard } from "./infrastructure/guards/parsing/ai-usage.guard.js";
import { AiController } from "./presentation/controllers/parsing/ai.controller.js";

@Module({
  imports: [
    AccessModule,
    IdentitySettingsModule,
    IdentityUserAccessModule,
    NotificationDeliveryModule,
    PlanningCategoriesModule,
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
    { provide: AI_PROVIDER, useClass: GeminiAiAdapter },
    { provide: AI_QUOTA, useExisting: ACCESS_AI_QUOTA },
    { provide: USER_CATEGORY_READER, useClass: TodoCategoryReaderAdapter },
    { provide: USER_LOCALE_PREFERENCE_READER, useClass: UserLocalePreferenceReader },
    aiTaskSettingsProvider,
    ...AI_PROVIDERS,
  ],
  exports: [
    AI_PROVIDER,
    USER_LOCALE_PREFERENCE_READER,
    AI_TASK_SETTINGS,
    AI_DATA_SHARING_CONSENT_DECISION_READER,
    AI_CLIENT_APP_VERSION_READER,
    AiDataSharingConsentGuard,
  ],
})
export class AiAssistanceParsingModule {}
