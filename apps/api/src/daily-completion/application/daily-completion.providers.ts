import { GetDailyCompletionsUseCase } from "./queries/get-daily-completions/get-daily-completions.use-case";
import { GetFriendDailyCompletionsUseCase } from "./queries/get-friend-daily-completions/get-friend-daily-completions.use-case";

export const DAILY_COMPLETION_PROVIDERS = [
	GetDailyCompletionsUseCase,
	GetFriendDailyCompletionsUseCase,
] as const;
