/**
 * MemoController 단위 테스트
 *
 * Suites + GWT 패턴 적용
 * - Suites: TestBed.solitary()로 자동 Mock 생성
 * - GWT: Given/When/Then 주석으로 테스트 구조화
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test memo.controller
 * ```
 */

import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import type { CurrentUserPayload } from "@/auth/presentation/decorators";

import {
	GetMemoResourceLimitUseCase,
	GetMemosUseCase,
	GetMemoUseCase,
} from "../application/queries";
import {
	ConvertMemoToTodoUseCase,
	CreateMemoUseCase,
	DeleteMemoUseCase,
	ReorderMemoUseCase,
	ToggleMemoPinUseCase,
	UpdateMemoUseCase,
} from "../application/use-cases";
import type {
	ConvertMemoToTodoDto,
	CreateMemoDto,
	GetMemosQueryDto,
	ReorderMemoDto,
	ToggleMemoPinDto,
	UpdateMemoDto,
} from "./dtos";
import { MemoController } from "./memo.controller";

describe("MemoController — 메모 컨트롤러", () => {
	let controller: MemoController;
	let createMemoUseCase: Mocked<CreateMemoUseCase>;
	let getMemosUseCase: Mocked<GetMemosUseCase>;
	let getMemoUseCase: Mocked<GetMemoUseCase>;
	let getMemoResourceLimitUseCase: Mocked<GetMemoResourceLimitUseCase>;
	let updateMemoUseCase: Mocked<UpdateMemoUseCase>;
	let toggleMemoPinUseCase: Mocked<ToggleMemoPinUseCase>;
	let reorderMemoUseCase: Mocked<ReorderMemoUseCase>;
	let deleteMemoUseCase: Mocked<DeleteMemoUseCase>;
	let convertMemoToTodoUseCase: Mocked<ConvertMemoToTodoUseCase>;

	const mockUser: CurrentUserPayload = {
		userId: "user-123",
		email: "test@example.com",
		sessionId: "session-123",
		role: "USER",
	};

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(MemoController).compile();

		controller = unit;
		createMemoUseCase = unitRef.get(CreateMemoUseCase);
		getMemosUseCase = unitRef.get(GetMemosUseCase);
		getMemoUseCase = unitRef.get(GetMemoUseCase);
		getMemoResourceLimitUseCase = unitRef.get(GetMemoResourceLimitUseCase);
		updateMemoUseCase = unitRef.get(UpdateMemoUseCase);
		toggleMemoPinUseCase = unitRef.get(ToggleMemoPinUseCase);
		reorderMemoUseCase = unitRef.get(ReorderMemoUseCase);
		deleteMemoUseCase = unitRef.get(DeleteMemoUseCase);
		convertMemoToTodoUseCase = unitRef.get(ConvertMemoToTodoUseCase);
	});

	describe("create", () => {
		it("메모 생성 요청을 서비스에 위임하고 결과를 반환해야 한다", async () => {
			// Given - 생성 DTO와 서비스 응답이 준비되었을 때
			const dto = { content: "테스트 메모" } as unknown as CreateMemoDto;
			const serviceResult = {
				message: "메모가 생성되었습니다.",
				memo: { id: 1, content: "테스트 메모" },
			};
			createMemoUseCase.execute.mockResolvedValue(serviceResult as any);

			// When - create를 호출하면
			const result = await controller.create(mockUser, dto);

			// Then - 서비스에 userId와 content를 전달하고 결과를 반환해야 한다
			expect(createMemoUseCase.execute).toHaveBeenCalledWith({
				userId: mockUser.userId,
				content: dto.content,
			});
			expect(result).toEqual(serviceResult);
		});
	});

	describe("findMany", () => {
		it("메모 목록 조회 요청을 서비스에 위임하고 결과를 반환해야 한다", async () => {
			// Given - 목록 조회 쿼리와 서비스 응답이 준비되었을 때
			const query = {
				cursor: undefined,
				size: 20,
			} as unknown as GetMemosQueryDto;
			const serviceResult = {
				items: [],
				pagination: { hasNext: false, nextCursor: null, size: 20 },
			};
			getMemosUseCase.execute.mockResolvedValue(serviceResult as any);

			// When - findMany를 호출하면
			const result = await controller.findMany(mockUser, query);

			// Then - 서비스에 userId, cursor, size를 전달하고 결과를 반환해야 한다
			expect(getMemosUseCase.execute).toHaveBeenCalledWith({
				userId: mockUser.userId,
				cursor: query.cursor,
				size: query.size,
			});
			expect(result).toEqual(serviceResult);
		});
	});

	describe("findOne", () => {
		it("메모 상세 조회 요청을 서비스에 위임하고 결과를 반환해야 한다", async () => {
			// Given - 조회 대상 메모 ID와 서비스 응답이 준비되었을 때
			const params = { id: 1 };
			const serviceResult = {
				memo: { id: 1, content: "테스트 메모" },
			};
			getMemoUseCase.execute.mockResolvedValue(serviceResult as any);

			// When - findOne을 호출하면
			const result = await controller.findOne(mockUser, params);

			// Then - 서비스에 userId와 memoId를 전달하고 결과를 반환해야 한다
			expect(getMemoUseCase.execute).toHaveBeenCalledWith({
				userId: mockUser.userId,
				memoId: params.id,
			});
			expect(result).toEqual(serviceResult);
		});
	});

	describe("update", () => {
		it("메모 수정 요청을 서비스에 위임하고 결과를 반환해야 한다", async () => {
			// Given - 수정 DTO와 서비스 응답이 준비되었을 때
			const params = { id: 1 };
			const dto = { content: "수정된 메모" } as unknown as UpdateMemoDto;
			const serviceResult = {
				message: "메모가 수정되었습니다.",
				memo: { id: 1, content: "수정된 메모" },
			};
			updateMemoUseCase.execute.mockResolvedValue(serviceResult as any);

			// When - update를 호출하면
			const result = await controller.update(mockUser, params, dto);

			// Then - 서비스에 userId, memoId, content를 전달하고 결과를 반환해야 한다
			expect(updateMemoUseCase.execute).toHaveBeenCalledWith({
				userId: mockUser.userId,
				memoId: params.id,
				content: dto.content,
			});
			expect(result).toEqual(serviceResult);
		});
	});

	describe("togglePin", () => {
		it("메모 고정/해제 요청을 서비스에 위임하고 결과를 반환해야 한다", async () => {
			// Given - 고정 토글 DTO와 서비스 응답이 준비되었을 때
			const params = { id: 1 };
			const dto = { isPinned: true } as unknown as ToggleMemoPinDto;
			const serviceResult = {
				message: "메모가 고정되었습니다.",
				memo: { id: 1, isPinned: true },
			};
			toggleMemoPinUseCase.execute.mockResolvedValue(serviceResult as any);

			// When - togglePin을 호출하면
			const result = await controller.togglePin(mockUser, params, dto);

			// Then - 서비스에 userId, memoId, isPinned를 전달하고 결과를 반환해야 한다
			expect(toggleMemoPinUseCase.execute).toHaveBeenCalledWith({
				userId: mockUser.userId,
				memoId: params.id,
				isPinned: dto.isPinned,
			});
			expect(result).toEqual(serviceResult);
		});
	});

	describe("reorder", () => {
		it("메모 순서 변경 요청을 서비스에 위임하고 결과를 반환해야 한다", async () => {
			// Given - 순서 변경 DTO와 서비스 응답이 준비되었을 때
			const params = { id: 1 };
			const dto = {
				targetMemoId: 2,
				position: "before",
			} as unknown as ReorderMemoDto;
			const serviceResult = {
				message: "메모 순서가 변경되었습니다.",
				memo: { id: 1, sortOrder: 0 },
			};
			reorderMemoUseCase.execute.mockResolvedValue(serviceResult as any);

			// When - reorder를 호출하면
			const result = await controller.reorder(mockUser, params, dto);

			// Then - 서비스에 memoId, userId, targetMemoId, position을 전달하고 결과를 반환해야 한다
			expect(reorderMemoUseCase.execute).toHaveBeenCalledWith({
				memoId: params.id,
				userId: mockUser.userId,
				targetMemoId: dto.targetMemoId,
				position: dto.position,
			});
			expect(result).toEqual(serviceResult);
		});
	});

	describe("remove", () => {
		it("메모 삭제 요청을 서비스에 위임하고 결과를 반환해야 한다", async () => {
			// Given - 삭제 대상 메모 ID와 서비스 응답이 준비되었을 때
			const params = { id: 1 };
			const serviceResult = { message: "메모가 삭제되었습니다." };
			deleteMemoUseCase.execute.mockResolvedValue(serviceResult);

			// When - remove를 호출하면
			const result = await controller.remove(mockUser, params);

			// Then - 서비스에 userId와 memoId를 전달하고 결과를 반환해야 한다
			expect(deleteMemoUseCase.execute).toHaveBeenCalledWith({
				userId: mockUser.userId,
				memoId: params.id,
			});
			expect(result).toEqual(serviceResult);
		});
	});

	describe("convertToTodo", () => {
		it("메모를 할 일로 변환 요청을 서비스에 위임하고 Date 객체를 전달해야 한다", async () => {
			// Given - 변환 DTO와 타임존, 서비스 응답이 준비되었을 때
			const params = { id: 1 };
			const dto = {
				categoryId: "category-1",
				startDate: "2026-04-06",
				endDate: undefined,
				scheduledTime: undefined,
				isAllDay: true,
				visibility: "PUBLIC",
			} as unknown as ConvertMemoToTodoDto;
			const tz = "Asia/Seoul";
			const serviceResult = {
				message: "메모가 할 일로 변환되었습니다.",
				todo: { id: "todo-1" },
			};
			convertMemoToTodoUseCase.execute.mockResolvedValue(serviceResult as any);

			// When - convertToTodo를 호출하면
			const result = await controller.convertToTodo(mockUser, params, dto, tz);

			// Then - 서비스에 Date 객체가 전달되고 결과를 반환해야 한다
			expect(convertMemoToTodoUseCase.execute).toHaveBeenCalledWith({
				userId: mockUser.userId,
				memoId: params.id,
				data: {
					categoryId: dto.categoryId,
					startDate: expect.any(Date),
					endDate: undefined,
					scheduledTime: undefined,
					isAllDay: dto.isAllDay,
					visibility: dto.visibility,
					items: undefined,
				},
			});
			expect(result).toEqual(serviceResult);
		});

		it("endDate와 scheduledTime이 있으면 Date 객체로 변환하여 전달해야 한다", async () => {
			// Given - endDate와 scheduledTime이 포함된 DTO가 준비되었을 때
			const params = { id: 1 };
			const dto = {
				categoryId: "category-1",
				startDate: "2026-04-06",
				endDate: "2026-04-07",
				scheduledTime: "14:00",
				isAllDay: false,
				visibility: "PRIVATE",
			} as unknown as ConvertMemoToTodoDto;
			const tz = "Asia/Seoul";
			const serviceResult = {
				message: "메모가 할 일로 변환되었습니다.",
				todo: { id: "todo-1" },
			};
			convertMemoToTodoUseCase.execute.mockResolvedValue(serviceResult as any);

			// When - convertToTodo를 호출하면
			const result = await controller.convertToTodo(mockUser, params, dto, tz);

			// Then - endDate와 scheduledTime이 Date 객체로 변환되어 전달되어야 한다
			expect(convertMemoToTodoUseCase.execute).toHaveBeenCalledWith({
				userId: mockUser.userId,
				memoId: params.id,
				data: {
					categoryId: dto.categoryId,
					startDate: expect.any(Date),
					endDate: expect.any(Date),
					scheduledTime: expect.any(Date),
					isAllDay: dto.isAllDay,
					visibility: dto.visibility,
					items: undefined,
				},
			});
			expect(result).toEqual(serviceResult);
		});
	});

	describe("getResourceLimit", () => {
		it("메모 리소스 제한 정보 조회를 서비스에 위임하고 결과를 반환해야 한다", async () => {
			// Given - 리소스 제한 정보 서비스 응답이 준비되었을 때
			const serviceResult = { currentCount: 5, maxPerUser: 50 };
			getMemoResourceLimitUseCase.execute.mockResolvedValue(serviceResult);

			// When - getResourceLimit를 호출하면
			const result = await controller.getResourceLimit(mockUser);

			// Then - 서비스에 userId를 전달하고 결과를 반환해야 한다
			expect(getMemoResourceLimitUseCase.execute).toHaveBeenCalledWith({
				userId: mockUser.userId,
			});
			expect(result).toEqual(serviceResult);
		});
	});
});
