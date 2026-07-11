/**
 * CreateMemoUseCase 단위 테스트
 */
import { MEMO_LIMITS } from "@aido/validators";
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { UNIT_OF_WORK, type UnitOfWorkPort } from "@/shared/application/ports";
import { Memo } from "../../../domain/entities/memo.entity";
import {
	MEMO_REPOSITORY,
	type MemoRepositoryPort,
} from "../../ports/memo.repository.port";
import { CreateMemoUseCase } from "./create-memo.use-case";

const memoEntity = (sortOrder: number): Memo =>
	Memo.reconstitute({
		id: 1,
		userId: "user-1",
		content: "내용",
		isPinned: false,
		sortOrder,
		createdAt: new Date(),
		updatedAt: new Date(),
	});

describe("CreateMemoUseCase — 메모 생성", () => {
	let useCase: CreateMemoUseCase;
	let uow: Mocked<UnitOfWorkPort>;
	let repository: Mocked<MemoRepositoryPort>;

	beforeEach(async () => {
		const { unit, unitRef } =
			await TestBed.solitary(CreateMemoUseCase).compile();
		useCase = unit;
		uow = unitRef.get(UNIT_OF_WORK);
		repository = unitRef.get(MEMO_REPOSITORY);

		uow.run.mockImplementation(async (fn) => fn());
	});

	it("한도 미만이면 max+1 순서로 생성한다", async () => {
		repository.countByUserId.mockResolvedValue(3);
		repository.getMaxSortOrder.mockResolvedValue(7);
		repository.create.mockResolvedValue(memoEntity(8));

		const result = await useCase.execute({ userId: "user-1", content: "내용" });

		expect(repository.create).toHaveBeenCalledWith("user-1", "내용", 8);
		expect(result.message).toBe("메모가 생성되었습니다.");
		expect(result.memo.id).toBe(1);
	});

	it("한도 도달이면 MEMO_2003을 던지고 생성하지 않는다", async () => {
		repository.countByUserId.mockResolvedValue(MEMO_LIMITS.MAX_PER_USER);

		await expect(
			useCase.execute({ userId: "user-1", content: "내용" }),
		).rejects.toMatchObject({ errorCode: "MEMO_2003" });
		expect(repository.create).not.toHaveBeenCalled();
	});
});
