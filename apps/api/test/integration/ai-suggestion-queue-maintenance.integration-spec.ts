import { AiSuggestionQueueMaintenanceService } from "@/ai-suggestion/infrastructure/queue/ai-suggestion-queue-maintenance.service";

describe("AiSuggestionQueueMaintenanceService integration", () => {
	it("vendor별 정리 명령 없이 runtime 보존 정책을 사용한다", async () => {
		const service = new AiSuggestionQueueMaintenanceService();

		await expect(service.cleanExpiredFailures()).resolves.toBe(0);
	});
});
