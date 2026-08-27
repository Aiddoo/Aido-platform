import { TransactionHost } from "@nestjs-cls/transactional";
import type { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";
import { TestBed } from "@suites/unit";
import { asMock, createMockPrisma, type MockPrismaClient } from "@test/mocks";

import { DELETED_COMMENT_AUTHOR } from "@/shared/domain/system-user";
import type { DatabaseService } from "@/shared/infrastructure/database/database.service";

import { PrismaFollowRepository } from "./prisma-follow.repository";

describe("PrismaFollowRepository 사용자 대상 제한", () => {
	let repository: PrismaFollowRepository;
	let db: MockPrismaClient;

	beforeEach(async () => {
		db = createMockPrisma();
		const { unit } = await TestBed.solitary(PrismaFollowRepository)
			.mock<TransactionHost<TransactionalAdapterPrisma<DatabaseService>>>(TransactionHost)
			.impl(() => ({ tx: db }))
			.compile();
		repository = unit;
	});

	it("ID 친구 요청은 ACTIVE이고 삭제되지 않은 사용자만 찾는다", async () => {
		asMock(db.user.findFirst).mockResolvedValue(null);

		await expect(repository.userExists("locked-system-user")).resolves.toBe(false);
		expect(db.user.findFirst).toHaveBeenCalledWith({
			where: { id: "locked-system-user", status: "ACTIVE", deletedAt: null },
			select: { id: true },
		});
	});

	it("태그 친구 요청도 LOCKED·삭제 사용자를 후보에서 제외한다", async () => {
		asMock(db.user.findFirst).mockResolvedValue(null);

		await expect(repository.findUserByTag(DELETED_COMMENT_AUTHOR.userTag)).resolves.toBeNull();
		expect(db.user.findFirst).toHaveBeenCalledWith({
			where: {
				userTag: DELETED_COMMENT_AUTHOR.userTag,
				status: "ACTIVE",
				deletedAt: null,
			},
			select: { id: true },
		});
	});
});
