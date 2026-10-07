import {
  getDailyCompletionsProvider,
  getFriendDailyCompletionsProvider,
} from "./insights-daily-completions-application.providers.js";

export const DAILY_COMPLETION_PROVIDERS = [
  getDailyCompletionsProvider,
  getFriendDailyCompletionsProvider,
] as const;
