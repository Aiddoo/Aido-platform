import { TransactionHost } from "@nestjs-cls/transactional";
import type { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";
import { TestBed } from "@suites/unit";
import { PushTokenBuilder } from "@test/builders";
import { asMock, createMockPrisma, type MockPrismaClient } from "@test/mocks";

import type { DatabaseService } from "@/shared/infrastructure/database/database.service";

import type {
	FindPushTokensParams,
	RegisterPushTokenData,
} from "../../application/ports/notification-data";
import { PrismaPushTokenRepository } from "./prisma-push-token.repository";

describe("PrismaPushTokenRepository", () => {
	let repository: PrismaPushTokenRepository;
	let db: MockPrismaClient;

	beforeEach(async () => {
		PushTokenBuilder.resetIdCounter();
		db = createMockPrisma();
		const { unit } = await TestBed.solitary(PrismaPushTokenRepository)
			.mock<TransactionHost<TransactionalAdapterPrisma<DatabaseService>>>(TransactionHost)
			.impl(() => ({ tx: db }))
			.compile();
		repository = unit;
	});

	it("사용자와 deviceId 복합 키로 푸시 토큰을 upsert한다", async () => {
		const data: RegisterPushTokenData = {
			userId: "user-1",
			token: "ExponentPushToken[valid]",
			deviceId: "device-1",
			platform: "IOS",
		};
		const expected = PushTokenBuilder.create("user-1").withDeviceId("device-1").build();
		asMock(db.pushToken.upsert).mockResolvedValue(expected);

		await expect(repository.registerPushToken(data)).resolves.toEqual(expected);
		expect(db.pushToken.upsert).toHaveBeenCalledWith({
			where: { userId_deviceId: { userId: "user-1", deviceId: "device-1" } },
			create: {
				userId: "user-1",
				token: data.token,
				deviceId: "device-1",
				platform: "IOS",
				isActive: true,
				payloadVersion: 1,
				appVersion: undefined,
			},
			update: {
				token: data.token,
				platform: "IOS",
				isActive: true,
				payloadVersion: 1,
				appVersion: undefined,
				updatedAt: expect.any(Date),
			},
		});
	});

	it("deviceId와 platform이 없으면 기존 호환 기본값을 유지한다", async () => {
		const expected = PushTokenBuilder.create("user-1").withDeviceId("default").build();
		asMock(db.pushToken.upsert).mockResolvedValue(expected);

		await repository.registerPushToken({ userId: "user-1", token: expected.token });
		expect(db.pushToken.upsert).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { userId_deviceId: { userId: "user-1", deviceId: "default" } },
				create: expect.objectContaining({ deviceId: "default", platform: "IOS" }),
			}),
		);
	});

	it("사용자 토큰을 최신 갱신 순으로 조회한다", async () => {
		const params: FindPushTokensParams = { userId: "user-1" };
		const tokens = [PushTokenBuilder.create("user-1").build()];
		asMock(db.pushToken.findMany).mockResolvedValue(tokens);

		await expect(repository.findPushTokensByUser(params)).resolves.toEqual(tokens);
		expect(db.pushToken.findMany).toHaveBeenCalledWith({
			where: { userId: "user-1" },
			orderBy: { updatedAt: "desc" },
		});
	});

	it("activeOnly가 true이면 활성 토큰만 조회한다", async () => {
		asMock(db.pushToken.findMany).mockResolvedValue([]);

		await repository.findPushTokensByUser({ userId: "user-1", activeOnly: true });
		expect(db.pushToken.findMany).toHaveBeenCalledWith(
			expect.objectContaining({ where: { userId: "user-1", isActive: true } }),
		);
	});

	it("여러 사용자의 활성 토큰을 한 쿼리로 조회한다", async () => {
		asMock(db.pushToken.findMany).mockResolvedValue([]);

		await repository.findActivePushTokensByUsers(["user-1", "user-2"]);
		expect(db.pushToken.findMany).toHaveBeenCalledWith({
			where: { userId: { in: ["user-1", "user-2"] }, isActive: true },
		});
	});

	it("특정 device 토큰을 복합 키로 삭제한다", async () => {
		const token = PushTokenBuilder.create("user-1").build();
		asMock(db.pushToken.delete).mockResolvedValue(token);

		await expect(repository.deletePushToken("user-1", "device-1")).resolves.toEqual(token);
		expect(db.pushToken.delete).toHaveBeenCalledWith({
			where: { userId_deviceId: { userId: "user-1", deviceId: "device-1" } },
		});
	});

	it("사용자의 모든 토큰을 삭제한다", async () => {
		asMock(db.pushToken.deleteMany).mockResolvedValue({ count: 3 });

		await expect(repository.deleteAllPushTokensByUser("user-1")).resolves.toEqual({ count: 3 });
		expect(db.pushToken.deleteMany).toHaveBeenCalledWith({ where: { userId: "user-1" } });
	});

	it("무효 토큰을 한 번의 updateMany로 비활성화한다", async () => {
		const tokens = ["invalid-1", "invalid-2"];
		asMock(db.pushToken.updateMany).mockResolvedValue({ count: 2 });

		await expect(repository.deactivateInvalidTokens(tokens)).resolves.toEqual({ count: 2 });
		expect(db.pushToken.updateMany).toHaveBeenCalledWith({
			where: { token: { in: tokens } },
			data: { isActive: false },
		});
	});
});
