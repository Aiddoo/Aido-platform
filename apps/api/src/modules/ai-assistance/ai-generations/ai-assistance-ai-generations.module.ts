import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { IdentityUserPreferencesModule } from "#api/modules/identity/user-preferences/identity-user-preferences.public";
import { IdentityUsersQueriesModule } from "#api/modules/identity/users/identity-users.public";
import { NotificationPushDevicesModule } from "#api/modules/notification/push-devices/notification-push-devices.public";

import { aiAssistanceAiGenerationsConfig } from "./ai-assistance-ai-generations.config.js";
import { AI_ASSISTANCE_AI_GENERATIONS_PROVIDERS } from "./ai-assistance-ai-generations.providers.js";
import { AiGeneratorPort } from "./application/ports/ai-generator.port.js";
import { UserLocalePreferenceReaderPort } from "./application/ports/user-locale-preference.reader.port.js";
import { ScheduledAiConsentReader } from "./application/scheduled-ai-consent.reader.js";

/**
 * AI 업체 연결·폴백·회로·비용 예산과 모든 AI 작업이 함께 쓰는 요청 문맥(동의·언어·앱 버전).
 * 회로·bulkhead는 전역 OutboundPolicyRegistry, 예산 누적은 UsageMeter, 경보는 OperationalAlertPort를 쓴다.
 */
@Module({
  imports: [
    ConfigModule.forFeature(aiAssistanceAiGenerationsConfig),
    IdentityUserPreferencesModule,
    IdentityUsersQueriesModule,
    NotificationPushDevicesModule,
  ],
  providers: [...AI_ASSISTANCE_AI_GENERATIONS_PROVIDERS],
  exports: [AiGeneratorPort, UserLocalePreferenceReaderPort, ScheduledAiConsentReader],
})
export class AiAssistanceAiGenerationsModule {}
