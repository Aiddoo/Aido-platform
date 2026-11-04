import { type FactoryProvider, Module } from "@nestjs/common";

import { AI_GENERATOR } from "./application/ports/generation/ai-generator.port.js";
import { AiSdkGenerator } from "./infrastructure/adapters/generation/ai-sdk.generator.js";
import { AiSpendGuard } from "./infrastructure/adapters/generation/ai-spend.guard.js";
import {
  AI_PROVIDER_ADAPTERS,
  type AiProviderAdapter,
} from "./infrastructure/adapters/generation/providers/ai-provider-adapter.js";
import { AnthropicProviderAdapter } from "./infrastructure/adapters/generation/providers/anthropic.provider-adapter.js";
import { GoogleProviderAdapter } from "./infrastructure/adapters/generation/providers/google.provider-adapter.js";
import { OpenAiProviderAdapter } from "./infrastructure/adapters/generation/providers/openai.provider-adapter.js";

const providerAdaptersProvider: FactoryProvider<readonly AiProviderAdapter[]> = {
  provide: AI_PROVIDER_ADAPTERS,
  inject: [AnthropicProviderAdapter, GoogleProviderAdapter, OpenAiProviderAdapter],
  useFactory: (...adapters: AiProviderAdapter[]) => adapters,
};

/**
 * AI 업체 연결·폴백·회로·비용 예산. 회로·bulkhead는 전역 OutboundPolicyRegistry,
 * 예산 누적은 USAGE_METER, 경보는 OPERATIONAL_ALERT를 쓴다. 다른 모듈은 AI_GENERATOR만 쓴다.
 */
@Module({
  providers: [
    AnthropicProviderAdapter,
    GoogleProviderAdapter,
    OpenAiProviderAdapter,
    providerAdaptersProvider,
    AiSpendGuard,
    { provide: AI_GENERATOR, useClass: AiSdkGenerator },
  ],
  exports: [AI_GENERATOR],
})
export class AiAssistanceGenerationModule {}
