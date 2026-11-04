import {
  aiTaskSettingsProvider,
  getAiUsageProvider,
  parseMemoProvider,
  parseTodoProvider,
} from "./ai-assistance-parsing-application.providers.js";

export const AI_PARSING_PROVIDERS = [
  aiTaskSettingsProvider,
  parseTodoProvider,
  parseMemoProvider,
  getAiUsageProvider,
] as const;
