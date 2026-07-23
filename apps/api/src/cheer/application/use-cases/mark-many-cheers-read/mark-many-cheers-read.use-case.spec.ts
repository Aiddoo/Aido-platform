/**
 * MarkManyCheersReadUseCase 단위 테스트 (Suites solitary + 포트 모킹).
 */
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { createCheerRepositoryMock } from "@test/mocks/ports/cheer.mock";

import {
	CHEER_REPOSITORY,
	type CheerRepositoryPort,
} from "../../ports/cheer.repository.port";
import { MarkManyCheersReadUseCase } from "./mark-many-cheers-read.use-case";

const USER = "u-receiver";

describe("MarkManyCheersReadUseCase — 여러 응원 일괄 읽음 처리", () => {
	let useCase: MarkManyCheersReadUseCase;
	let repo: Mocked<CheerRepositoryPort>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(MarkManyCheersReadUseCase)
			.mock<CheerRepositoryPort>(CHEER_REPOSITORY)
			.impl(() => createCheerRepositoryMock())
			.compile();
		useCase = unit;
		repo = unitRef.get<CheerRepositoryPort>(CHEER_REPOSITORY);
	});

	it("수신자 소유 + 미읽음 조건으로 일괄 갱신하고 처리 개수를 반환한다", async () => {
		// Given
		repo.markManyAsRead.mockResolvedValue(3);

		// When
		const count = await useCase.execute({
			userId: USER,
			cheerIds: [1, 2, 3, 4],
		});

		// Then
		expect(repo.markManyAsRead).toHaveBeenCalledWith([1, 2, 3, 4], USER);
		expect(count).toBe(3);
	});

	it("처리 대상이 없으면(이미 모두 읽음/타인 소유) 0을 반환한다 (멱등)", async () => {
		// Given
		repo.markManyAsRead.mockResolvedValue(0);

		// When
		const count = await useCase.execute({ userId: USER, cheerIds: [1, 2] });

		// Then
		expect(count).toBe(0);
	});

	it("빈 배열이면 저장소에 그대로 위임하고 0을 반환한다", async () => {
		// Given
		repo.markManyAsRead.mockResolvedValue(0);

		// When
		const count = await useCase.execute({ userId: USER, cheerIds: [] });

		// Then
		expect(repo.markManyAsRead).toHaveBeenCalledWith([], USER);
		expect(count).toBe(0);
	});
});
