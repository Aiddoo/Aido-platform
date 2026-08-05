import { GetDailyCompletionsUseCase } from "./get-daily-completions/get-daily-completions.use-case";
import { GetFriendDailyCompletionsUseCase } from "./get-friend-daily-completions/get-friend-daily-completions.use-case";

/** 모듈 등록용 쿼리 use-case 목록 */
export const DailyCompletionQueryUseCases = [
	GetDailyCompletionsUseCase,
	GetFriendDailyCompletionsUseCase,
];
