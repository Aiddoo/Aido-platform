import { TestBed } from "@suites/unit";
import { asMock, createMockPrisma, type MockPrismaClient } from "@test/mocks";

import { DatabaseService } from "@/shared/infrastructure/database/database.service";

import { PrismaSignupStatsReader } from "./prisma-signup-stats.reader";

describe("PrismaSignupStatsReader", () => {
	let reader: PrismaSignupStatsReader;
	let db: MockPrismaClient;

	beforeEach(async () => {
		db = createMockPrisma();
		const { unit } = await TestBed.solitary(PrismaSignupStatsReader)
			.mock(DatabaseService)
			.impl(() => db)
			.compile();
		reader = unit;
	});

	it("총 가입자는 인증 계정이 있는 사용자만 세어 시스템 FK 사용자를 제외한다", async () => {
		asMock(db.account.groupBy).mockResolvedValue([]);
		asMock(db.user.count).mockResolvedValue(12);

		await expect(
			reader.getSignupStats(
				new Date("2026-08-25T15:00:00.000Z"),
				new Date("2026-08-26T15:00:00.000Z"),
			),
		).resolves.toMatchObject({ totalUsers: 12 });
		expect(db.user.count).toHaveBeenCalledWith({ where: { accounts: { some: {} } } });
	});
});
