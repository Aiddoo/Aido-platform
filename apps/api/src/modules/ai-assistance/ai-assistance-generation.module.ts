import { type FactoryProvider, Module } from "@nestjs/common";

import { AI_GENERATOR } from "./application/ports/generation/ai-generator.port.js";
import { AI_PROVIDER_ALERT } from "./application/ports/generation/ai-provider-alert.port.js";
import { AiProviderCircuitRegistry } from "./infrastructure/adapters/generation/ai-provider-circuit.registry.js";
import { AiSdkGenerator } from "./infrastructure/adapters/generation/ai-sdk.generator.js";
import {
  AI_PROVIDER_ADAPTERS,
  type AiProviderAdapter,
} from "./infrastructure/adapters/generation/providers/ai-provider-adapter.js";
import { AnthropicProviderAdapter } from "./infrastructure/adapters/generation/providers/anthropic.provider-adapter.js";
import { GoogleProviderAdapter } from "./infrastructure/adapters/generation/providers/google.provider-adapter.js";
import { OpenAiProviderAdapter } from "./infrastructure/adapters/generation/providers/openai.provider-adapter.js";
import { SentryAiProviderAlertAdapter } from "./infrastructure/adapters/generation/sentry-ai-provider-alert.adapter.js";

const providerAdaptersProvider: FactoryProvider<readonly AiProviderAdapter[]> = {
  provide: AI_PROVIDER_ADAPTERS,
  inject: [AnthropicProviderAdapter, GoogleProviderAdapter, OpenAiProviderAdapter],
  useFactory: (...adapters: AiProviderAdapter[]) => adapters,
};

/** AI 업체 연결·폴백·회로. 다른 모듈은 AI_GENERATOR만 쓴다. */
@Module({
  providers: [
    AnthropicProviderAdapter,
    GoogleProviderAdapter,
    OpenAiProviderAdapter,
    providerAdaptersProvider,
    { provide: AI_PROVIDER_ALERT, useClass: SentryAiProviderAlertAdapter },
    AiProviderCircuitRegistry,
    { provide: AI_GENERATOR, useClass: AiSdkGenerator },
  ],
  exports: [AI_GENERATOR],
})
export class AiAssistanceGenerationModule {}
