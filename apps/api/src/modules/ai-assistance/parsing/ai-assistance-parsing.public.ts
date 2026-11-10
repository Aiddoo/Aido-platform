export { AiAssistanceParsingModule } from "./ai-assistance-parsing.module.js";
export {
  type ChargedGeneration,
  type ChargedGenerationResult,
  ChargedGenerationPort,
  type ChargeOutcome,
} from "./application/ports/charged-generation.port.js";
export { AiDataSharingConsentGuard } from "./presentation/http/guards/ai-data-sharing-consent.guard.js";
// 옛 진입점. voice가 generation public·ChargedGenerationPort로 옮기면 지운다
export {
  commitOrWarn,
  readFeatureQuotaOrNull,
  settleChargedGeneration,
} from "./infrastructure/adapters/quota-charged-generation.adapter.js";
export {
  fingerprintRequest,
  resolveRequestLocale,
  USER_LOCALE_PREFERENCE_READER,
  type UserLocalePreferenceReaderPort,
} from "../generation/ai-assistance-generation.public.js";
