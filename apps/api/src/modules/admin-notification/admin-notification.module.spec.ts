import { EventEmitterModule } from "@nestjs/event-emitter";
import { ScheduleModule } from "@nestjs/schedule";

import { AdminNotificationModule } from "./admin-notification.module";
import { DailySignupSummaryJob } from "./jobs/daily-signup-summary.job";
import { UserRegistrationListener } from "./listeners/user-registration.listener";
import { ADMIN_NOTIFIER } from "./providers/admin-notifier.interface";

describe("AdminNotificationModule", () => {
	let moduleImports: any[];
	let moduleProviders: any[];

	beforeEach(() => {
		const metadata = Reflect.getMetadata("imports", AdminNotificationModule);
		moduleImports = metadata ?? [];

		const providers = Reflect.getMetadata("providers", AdminNotificationModule);
		moduleProviders = providers ?? [];
	});

	it("ScheduleModule을 import하지 않아야 한다 (SchedulerModule에서 forRoot 등록됨)", () => {
		// Given - 모듈의 imports 메타데이터
		// When & Then - ScheduleModule이 포함되지 않음을 확인
		const hasScheduleModule = moduleImports.some(
			(imp: any) => imp === ScheduleModule || imp?.module === ScheduleModule,
		);
		expect(hasScheduleModule).toBe(false);
	});

	it("EventEmitterModule을 import하지 않아야 한다 (AppModule에서 forRoot 등록됨)", () => {
		// Given - 모듈의 imports 메타데이터
		// When & Then - EventEmitterModule이 포함되지 않음을 확인
		const hasEventEmitterModule = moduleImports.some(
			(imp: any) =>
				imp === EventEmitterModule || imp?.module === EventEmitterModule,
		);
		expect(hasEventEmitterModule).toBe(false);
	});

	it("필수 providers가 등록되어 있어야 한다", () => {
		// Given - 모듈의 providers 메타데이터
		// When
		const providerTokens = moduleProviders.map((p: any) => p?.provide ?? p);

		// Then - 필수 provider 토큰들이 모두 등록됨
		expect(providerTokens).toContain(ADMIN_NOTIFIER);
		expect(providerTokens).toContain(UserRegistrationListener);
		expect(providerTokens).toContain(DailySignupSummaryJob);
	});
});
