import { TEST_CUID } from "@test/fixtures";
import { asDep, mockOf } from "@test/mocks";
import { CacheService } from "@/shared/infrastructure/cache/cache.service";
import { TypedConfigService } from "@/shared/infrastructure/config/services/config.service";
import { DatabaseService } from "@/shared/infrastructure/database/database.service";
import { PrismaSchedulerReader } from "./prisma-scheduler.reader";

describe("PrismaSchedulerReader — 기존 사용자 무영향 격리", () => {
	const findMany = jest.fn();
	const preferenceFindMany = jest.fn();
	const database = mockOf<DatabaseService>({
		user: mockOf<DatabaseService["user"]>({ findMany }),
		userPreference: mockOf<DatabaseService["userPreference"]>({
			findMany: preferenceFindMany,
		}),
	});
	const cache = mockOf<CacheService>({
		wrapActiveTimezones: jest.fn((loader: () => Promise<string[]>) => loader()),
	});

	function reader(enabled: boolean): PrismaSchedulerReader {
		const config = mockOf<TypedConfigService>({
			retentionOnboardingV2: { enabled, treatmentPercent: 50 },
		});
		return new PrismaSchedulerReader(
			asDep(database),
			asDep(cache),
			asDep(config),
		);
	}

	it("kill switch가 꺼지면 legacy 후보 쿼리에 조건을 전혀 추가하지 않는다", async () => {
		findMany.mockResolvedValue([]);

		await reader(false).findOnboardingCandidates({
			tz: "Asia/Seoul",
			createdSince: new Date("2026-07-01T00:00:00Z"),
		});

		expect(findMany).toHaveBeenCalledWith({
			where: {
				createdAt: { gte: new Date("2026-07-01T00:00:00Z") },
				preference: { timezone: "Asia/Seoul" },
			},
			select: { id: true, createdAt: true },
		});
	});

	it("활성화 시에도 최근 TREATMENT relation만 제외해 기존 사용자는 매칭된다", async () => {
		findMany.mockResolvedValue([]);

		await reader(true).findOnboardingCandidates({
			tz: "Asia/Seoul",
			createdSince: new Date("2026-07-01T00:00:00Z"),
		});

		expect(findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({
					retentionAssignments: {
						none: expect.objectContaining({
							experimentKey: "onboarding_v2_d7",
							variant: "TREATMENT",
						}),
					},
				}),
			}),
		);
	});

	it("소셜 다이제스트는 직전 저녁 알림 수신 CUID만 후보로 조회한다", async () => {
		findMany.mockResolvedValue([]);
		const today = new Date("2026-07-16T00:00:00.000Z");
		const tomorrow = new Date("2026-07-17T00:00:00.000Z");

		await reader(false).findSocialDigestCandidates({
			tz: "Asia/Seoul",
			today,
			tomorrow,
			recipientUserIds: [TEST_CUID.USER_1, TEST_CUID.USER_2],
		});

		expect(findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({
					id: { in: [TEST_CUID.USER_1, TEST_CUID.USER_2] },
					preference: { timezone: "Asia/Seoul" },
				}),
			}),
		);
	});

	it("잘못 저장된 타임존은 스케줄러 활성 타임존에서 제외한다", async () => {
		preferenceFindMany.mockResolvedValue([
			{ timezone: "Asia/Seoul" },
			{ timezone: "Invalid/Timezone" },
			{ timezone: "UTC" },
		]);

		await expect(reader(false).findActiveTimezones()).resolves.toEqual([
			"Asia/Seoul",
			"UTC",
		]);
	});

	it("유효한 레거시 타임존 별칭은 저장값 그대로 반환해 기존 사용자를 누락하지 않는다", async () => {
		preferenceFindMany.mockResolvedValue([
			{ timezone: "UTC" },
			{ timezone: "Etc/UTC" },
			{ timezone: "Asia/Kolkata" },
			{ timezone: "Asia/Calcutta" },
		]);

		await expect(reader(false).findActiveTimezones()).resolves.toEqual([
			"UTC",
			"Etc/UTC",
			"Asia/Kolkata",
			"Asia/Calcutta",
		]);
	});
});
