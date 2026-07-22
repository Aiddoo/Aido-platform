import { AiSuggestionQueueMaintenanceService } from "./ai-suggestion-queue-maintenance.service";

describe("AiSuggestionQueueMaintenanceService", () => {
	it("보존 정책을 runtime에 위임하므로 별도 삭제를 수행하지 않는다", async () => {
		const service = new AiSuggestionQueueMaintenanceService();

		await expect(service.cleanExpiredFailures()).resolves.toBe(0);
	});
});
