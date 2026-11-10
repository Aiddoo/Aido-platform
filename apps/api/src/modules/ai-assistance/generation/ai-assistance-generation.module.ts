import { type FactoryProvider, Module } from "@nestjs/common";

import { AccessModule } from "#api/modules/access/access-entitlement.public";

import { AI_GENERATOR } from "./application/ports/ai-generator.port.js";
import {
  AI_PROVIDER_ADAPTERS,
  type AiProviderAdapter,
} from "./infrastructure/adapters/ai-provider.adapter.js";
import { AiSdkGeneratorAdapter } from "./infrastructure/adapters/ai-sdk-generator.adapter.js";
import { AiSpendBudgetAdapter } from "./infrastructure/adapters/ai-spend-budget.adapter.js";
import { AnthropicProviderAdapter } from "./infrastructure/adapters/anthropic-provider.adapter.js";
import { GoogleProviderAdapter } from "./infrastructure/adapters/google-provider.adapter.js";
import { OpenAiProviderAdapter } from "./infrastructure/adapters/openai-provider.adapter.js";

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
  imports: [AccessModule],
  providers: [
    AnthropicProviderAdapter,
    GoogleProviderAdapter,
    OpenAiProviderAdapter,
    providerAdaptersProvider,
    AiSpendBudgetAdapter,
    { provide: AI_GENERATOR, useClass: AiSdkGeneratorAdapter },
  ],
  exports: [AI_GENERATOR],
})
export class AiAssistanceGenerationModule {}
