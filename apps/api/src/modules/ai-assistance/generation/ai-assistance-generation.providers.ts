import type { Provider } from "@nestjs/common";

import { AiDataSharingConsentReaderPort } from "#api/modules/identity/identity-settings.public";
import { provideUseCase } from "#api/platform/di/provide-use-case";
import { ClockPort } from "#api/shared/application/ports/clock.port";

import { AiGeneratorPort } from "./application/ports/ai-generator.port.js";
import { AiClientAppVersionReaderPort } from "./application/ports/client-app-version.reader.port.js";
import { UserLocalePreferenceReaderPort } from "./application/ports/user-locale-preference.reader.port.js";
import { ScheduledAiConsentReader } from "./application/scheduled-ai-consent.reader.js";
import {
  type AiProviderAdapter,
  AiProviderCatalog,
} from "./infrastructure/adapters/ai-provider.adapter.js";
import { AiSdkGeneratorAdapter } from "./infrastructure/adapters/ai-sdk-generator.adapter.js";
import { AiSpendBudgetAdapter } from "./infrastructure/adapters/ai-spend-budget.adapter.js";
import { AnthropicProviderAdapter } from "./infrastructure/adapters/anthropic-provider.adapter.js";
import { GoogleProviderAdapter } from "./infrastructure/adapters/google-provider.adapter.js";
import { LatestClientAppVersionAdapter } from "./infrastructure/adapters/latest-client-app-version.adapter.js";
import { OpenAiProviderAdapter } from "./infrastructure/adapters/openai-provider.adapter.js";
import { UserLocalePreferenceReaderAdapter } from "./infrastructure/adapters/user-locale-preference-reader.adapter.js";

export const AI_ASSISTANCE_GENERATION_PROVIDERS = [
  AnthropicProviderAdapter,
  GoogleProviderAdapter,
  OpenAiProviderAdapter,
  {
    provide: AiProviderCatalog,
    inject: [AnthropicProviderAdapter, GoogleProviderAdapter, OpenAiProviderAdapter],
    useFactory: (...adapters: AiProviderAdapter[]) => new AiProviderCatalog(adapters),
  },
  AiSpendBudgetAdapter,
  { provide: AiGeneratorPort, useClass: AiSdkGeneratorAdapter },
  { provide: UserLocalePreferenceReaderPort, useClass: UserLocalePreferenceReaderAdapter },
  { provide: AiClientAppVersionReaderPort, useClass: LatestClientAppVersionAdapter },
  provideUseCase(ScheduledAiConsentReader, {
    consentReader: AiDataSharingConsentReaderPort,
    clientAppVersion: AiClientAppVersionReaderPort,
    clock: ClockPort,
  }),
] satisfies Provider[];
