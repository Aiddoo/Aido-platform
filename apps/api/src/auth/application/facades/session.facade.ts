import { Injectable } from "@nestjs/common";
import { ListActiveSessionsQuery, RevokeSessionUseCase } from "../use-cases";

/** 세션 조회·폐기의 단일 presentation 진입점. */
@Injectable()
export class SessionFacade {
	constructor(
		private readonly listActiveSessionsQuery: ListActiveSessionsQuery,
		private readonly revokeSessionUseCase: RevokeSessionUseCase,
	) {}

	getActiveSessions(
		...args: Parameters<ListActiveSessionsQuery["execute"]>
	): ReturnType<ListActiveSessionsQuery["execute"]> {
		return this.listActiveSessionsQuery.execute(...args);
	}

	revokeSession(
		...args: Parameters<RevokeSessionUseCase["execute"]>
	): ReturnType<RevokeSessionUseCase["execute"]> {
		return this.revokeSessionUseCase.execute(...args);
	}
}
