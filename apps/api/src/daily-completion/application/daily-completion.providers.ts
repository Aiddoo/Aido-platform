import { GetDailyCompletionsUseCase } from "./queries/get-daily-completions/get-daily-completions.use-case.js";
import { GetFriendDailyCompletionsUseCase } from "./queries/get-friend-daily-completions/get-friend-daily-completions.use-case.js";

export const DAILY_COMPLETION_PROVIDERS = [
	GetDailyCompletionsUseCase,
	GetFriendDailyCompletionsUseCase,
] as const;
