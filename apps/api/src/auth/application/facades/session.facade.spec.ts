import { mock } from "jest-mock-extended";
import { ListActiveSessionsQuery, RevokeSessionUseCase } from "../use-cases";
import { SessionFacade } from "./session.facade";

describe("SessionFacade — 세션 진입점", () => {
	it("세션 query/command를 분리해 위임한다", async () => {
		const listSessions = mock<ListActiveSessionsQuery>();
		const revokeSession = mock<RevokeSessionUseCase>();
		const facade = new SessionFacade(listSessions, revokeSession);

		await facade.getActiveSessions("user-1");
		await facade.revokeSession("user-1", "session-1");

		expect(listSessions.execute).toHaveBeenCalledWith("user-1");
		expect(revokeSession.execute).toHaveBeenCalledWith("user-1", "session-1");
	});
});
