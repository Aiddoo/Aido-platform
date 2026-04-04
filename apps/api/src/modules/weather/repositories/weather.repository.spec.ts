/**
 * WeatherRepository 단위 테스트
 *
 * Suites + Builder + GWT 패턴 적용
 *
 * 실행 명령:
 * pnpm --filter @aido/api test weather.repository.spec
 */

import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { UserLocationBuilder } from "@test/builders";
import { DatabaseService } from "@/database/database.service";
import {
	type UpsertLocationData,
	WeatherRepository,
} from "./weather.repository";

describe("WeatherRepository", () => {
	let repository: WeatherRepository;
	let db: Mocked<DatabaseService>;

	beforeEach(async () => {
		UserLocationBuilder.resetIdCounter();

		const { unit, unitRef } =
			await TestBed.solitary(WeatherRepository).compile();

		repository = unit;
		db = unitRef.get(DatabaseService);
	});

	// ========================================
	// findByUserId
	// ========================================

	describe("findByUserId", () => {
		it("사용자 ID로 위치를 조회해야 한다", async () => {
			// Given
			const location = UserLocationBuilder.create("user-1").build();
			(db.userLocation.findUnique as jest.Mock).mockResolvedValue(location);

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
			(db.userLocation.findUnique as jest.Mock).mockResolvedValue(null);

			// When
			const result = await repository.findByUserId("user-999");

			// Then
			expect(result).toBeNull();
		});

		it("트랜잭션 클라이언트를 사용해야 한다", async () => {
			// Given
			const mockFindUnique = jest.fn().mockResolvedValue(null);
			const txClient = {
				userLocation: { findUnique: mockFindUnique },
			} as unknown as Parameters<typeof repository.findByUserId>[1];

			// When
			await repository.findByUserId("user-1", txClient);

			// Then — tx 클라이언트의 findUnique가 호출됨
			expect(mockFindUnique).toHaveBeenCalledWith({
				where: { userId: "user-1" },
			});
			expect(db.userLocation.findUnique).not.toHaveBeenCalled();
		});
	});

	// ========================================
	// upsert
	// ========================================

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
			(db.userLocation.upsert as jest.Mock).mockResolvedValue(expected);

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

		it("트랜잭션 클라이언트를 사용해야 한다", async () => {
			// Given
			const mockUpsert = jest.fn().mockResolvedValue({});
			const txClient = {
				userLocation: { upsert: mockUpsert },
			} as unknown as Parameters<typeof repository.upsert>[2];

			// When
			await repository.upsert("user-1", upsertData, txClient);

			// Then
			expect(mockUpsert).toHaveBeenCalled();
			expect(db.userLocation.upsert).not.toHaveBeenCalled();
		});
	});

	// ========================================
	// delete
	// ========================================

	describe("delete", () => {
		it("사용자의 위치를 삭제해야 한다", async () => {
			// Given
			(db.userLocation.deleteMany as jest.Mock).mockResolvedValue({
				count: 1,
			});

			// When
			await repository.delete("user-1");

			// Then
			expect(db.userLocation.deleteMany).toHaveBeenCalledWith({
				where: { userId: "user-1" },
			});
		});

		it("트랜잭션 클라이언트를 사용해야 한다", async () => {
			// Given
			const mockDeleteMany = jest.fn().mockResolvedValue({ count: 1 });
			const txClient = {
				userLocation: { deleteMany: mockDeleteMany },
			} as unknown as Parameters<typeof repository.delete>[1];

			// When
			await repository.delete("user-1", txClient);

			// Then
			expect(mockDeleteMany).toHaveBeenCalledWith({
				where: { userId: "user-1" },
			});
			expect(db.userLocation.deleteMany).not.toHaveBeenCalled();
		});
	});
});
