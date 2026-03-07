import { AdminNotificationModule } from "./admin-notification.module";
import { DailySignupSummaryJob } from "./jobs/daily-signup-summary.job";
import { ADMIN_NOTIFIER } from "./providers/admin-notifier.interface";
import { AdminNotificationQueueService } from "./queue/admin-notification-queue.service";

describe("AdminNotificationModule", () => {
	let moduleProviders: any[];

	beforeEach(() => {
		const providers = Reflect.getMetadata("providers", AdminNotificationModule);
		moduleProviders = providers ?? [];
	});

	it("필수 providers가 등록되어 있어야 한다", () => {
		// Given - 모듈의 providers 메타데이터
		// When
		const providerTokens = moduleProviders.map((p: any) => p?.provide ?? p);

		// Then - 필수 provider 토큰들이 모두 등록됨
		expect(providerTokens).toContain(ADMIN_NOTIFIER);
		expect(providerTokens).toContain(AdminNotificationQueueService);
		expect(providerTokens).toContain(DailySignupSummaryJob);
	});
});
