import { Output } from "ai";
import type { z } from "zod";

import type { AiGenerationRequest, AiTaskId } from "../../application/ports/ai-generator.port.js";
import type { AiGenerationPolicy } from "./ai-generation-policy.constants.js";
import type { AiProviderAdapter, AiProviderModel } from "./ai-provider.adapter.js";
import { withoutRetryOnBillingFailure } from "./ai-sdk-failure.mapper.js";

interface ProviderCall<TOutput> {
  readonly adapter: AiProviderAdapter;
  readonly model: AiProviderModel;
  readonly request: Pick<AiGenerationRequest<AiTaskId>, "system" | "prompt">;
  readonly schema: z.ZodType<TOutput>;
  readonly policy: AiGenerationPolicy;
  /** 뒤에 시도할 업체가 없다. 이때만 SDK 재시도를 쓴다 */
  readonly isLast: boolean;
  readonly abortSignal: AbortSignal;
}

/** 한 업체에 보내는 AI SDK generateText 옵션. 고정 지시문에는 업체의 캐시 옵션을 붙인다. */
export function toGenerateTextOptions<TOutput>(call: ProviderCall<TOutput>) {
  const { adapter, model, request, schema, policy, isLast, abortSignal } = call;
  const systemOptions = adapter.getSystemProviderOptions(request.system);
  return {
    model: withoutRetryOnBillingFailure(model.model, (error) => adapter.classifyError(error)),
    ...(request.system !== "" && {
      instructions: {
        role: "system" as const,
        content: request.system,
        ...(systemOptions != null && { providerOptions: systemOptions }),
      },
    }),
    prompt: request.prompt,
    output: Output.object({ schema }),
    maxOutputTokens: policy.maxOutputTokens,
    maxRetries: isLast ? policy.lastProviderMaxRetries : 0,
    abortSignal,
    providerOptions: adapter.getProviderOptions(policy),
  };
}
