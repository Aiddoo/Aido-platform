import { asDep, mockOf } from "@test/mocks";
import { CacheService } from "@/shared/infrastructure/cache/cache.service";
import { TypedConfigService } from "@/shared/infrastructure/config/services/config.service";
import { DatabaseService } from "@/shared/infrastructure/database/database.service";
import { PrismaSchedulerReader } from "./prisma-scheduler.reader";

describe("PrismaSchedulerReader — 기존 사용자 무영향 격리", () => {
	const findMany = jest.fn();
	const database = mockOf<DatabaseService>({
		user: mockOf<DatabaseService["user"]>({ findMany }),
	});
	const cache = mockOf<CacheService>();

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
});
