import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { IdentitySettingsModule } from "#api/modules/identity/identity-settings.public";
import { IdentityUserAccessModule } from "#api/modules/identity/identity-user-access.public";
import { NotificationDeliveryModule } from "#api/modules/notification/notification-delivery.public";

import { aiAssistanceGenerationConfig } from "./ai-assistance-generation.config.js";
import { AI_ASSISTANCE_GENERATION_PROVIDERS } from "./ai-assistance-generation.providers.js";
import { AiGeneratorPort } from "./application/ports/ai-generator.port.js";
import {
  USER_LOCALE_PREFERENCE_READER,
  UserLocalePreferenceReaderPort,
} from "./application/ports/user-locale-preference.reader.port.js";
import { ScheduledAiConsentReader } from "./application/scheduled-ai-consent.reader.js";

/**
 * AI 업체 연결·폴백·회로·비용 예산과 모든 AI 작업이 함께 쓰는 요청 문맥(동의·언어·앱 버전).
 * 회로·bulkhead는 전역 OutboundPolicyRegistry, 예산 누적은 UsageMeter, 경보는 OperationalAlertPort를 쓴다.
 */
@Module({
  imports: [
    ConfigModule.forFeature(aiAssistanceGenerationConfig),
    IdentitySettingsModule,
    IdentityUserAccessModule,
    NotificationDeliveryModule,
  ],
  providers: [...AI_ASSISTANCE_GENERATION_PROVIDERS],
  exports: [
    AiGeneratorPort,
    UserLocalePreferenceReaderPort,
    USER_LOCALE_PREFERENCE_READER,
    ScheduledAiConsentReader,
  ],
})
export class AiAssistanceGenerationModule {}
