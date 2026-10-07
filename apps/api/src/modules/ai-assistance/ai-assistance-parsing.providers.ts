import {
  getAiUsageProvider,
  parseMemoProvider,
  parseTodoProvider,
} from "./ai-assistance-parsing-application.providers.js";

export const AI_PROVIDERS = [parseTodoProvider, parseMemoProvider, getAiUsageProvider] as const;
