/**
 * WeatherRepository 단위 테스트
 *
 * Suites + Builder + GWT 패턴 적용
 *
 * 실행 명령:
 * pnpm --filter @aido/api test weather.repository.spec
 */

import { TransactionHost } from "@nestjs-cls/transactional";
import type { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";
import { TestBed } from "@suites/unit";
import { UserLocationBuilder } from "@test/builders";
import { createMockPrisma, type MockPrismaClient } from "@test/mocks";
import type { DatabaseService } from "@/shared/infrastructure/database/database.service";
import {
	type UpsertLocationData,
	WeatherRepository,
} from "./weather.repository";

describe("WeatherRepository — 날씨 리포지토리", () => {
	let repository: WeatherRepository;
	let db: MockPrismaClient;

	beforeEach(async () => {
		UserLocationBuilder.resetIdCounter();

		// 리포지토리는 CLS TransactionHost.tx에서 클라이언트를 읽으므로
		// tx가 Prisma mock을 반환하도록 스텁합니다.
		db = createMockPrisma();

		const { unit } = await TestBed.solitary(WeatherRepository)
			.mock<TransactionHost<TransactionalAdapterPrisma<DatabaseService>>>(
				TransactionHost,
			)
			.impl(() => ({ tx: db }))
			.compile();

		repository = unit;
	});

	describe("findByUserId", () => {
		it("사용자 ID로 위치를 조회해야 한다", async () => {
			// Given
			const location = UserLocationBuilder.create("user-1").build();
			jest.mocked(db.userLocation.findUnique).mockResolvedValue(location);

			// When
			const result = await repository.findByUserId("user-1");

			// Then
			expect(db.userLocation.findUnique).toHaveBeenCalledWith({
				where: { userId: "user-1" },
			});
			expect(result).toEqual(location);
		});

		it("위치가 없으면 null을 반환해야 한다", async () => {
			// Given
			jest.mocked(db.userLocation.findUnique).mockResolvedValue(null);

			// When
			const result = await repository.findByUserId("user-999");

			// Then
			expect(result).toBeNull();
		});
	});

	describe("upsert", () => {
		const upsertData: UpsertLocationData = {
			latitude: 37.5665,
			longitude: 126.978,
			gridX: 60,
			gridY: 127,
		};

		it("위치를 생성 또는 업데이트해야 한다", async () => {
			// Given
			const expected = UserLocationBuilder.create("user-1").build();
			jest.mocked(db.userLocation.upsert).mockResolvedValue(expected);

			// When
			const result = await repository.upsert("user-1", upsertData);

			// Then
			expect(db.userLocation.upsert).toHaveBeenCalledWith({
				where: { userId: "user-1" },
				create: { userId: "user-1", ...upsertData },
				update: upsertData,
			});
			expect(result).toEqual(expected);
		});
	});

	describe("delete", () => {
		it("사용자의 위치를 삭제해야 한다", async () => {
			// Given
			jest.mocked(db.userLocation.deleteMany).mockResolvedValue({
				count: 1,
			});

			// When
			await repository.delete("user-1");

			// Then
			expect(db.userLocation.deleteMany).toHaveBeenCalledWith({
				where: { userId: "user-1" },
			});
		});
	});
});
