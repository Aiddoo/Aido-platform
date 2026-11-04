export { AiAssistanceGenerationModule } from "./ai-assistance-generation.module.js";
export {
  AI_GENERATOR,
  AI_TASK_IDS,
  type AiGenerationMeta,
  type AiGenerationRequest,
  type AiGenerationResult,
  type AiGeneratorPort,
  type AiTaskId,
} from "./application/ports/generation/ai-generator.port.js";
export {
  AiGenerationError,
  type AiFailureKind,
  isTransientAiFailure,
  resolveAiFailureRule,
} from "./application/ports/generation/ai-generation.errors.js";
