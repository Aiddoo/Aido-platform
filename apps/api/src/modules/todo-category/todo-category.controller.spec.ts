/**
 * TodoCategoryController 단위 테스트
 *
 * Suites + GWT 패턴 적용
 * - Suites: TestBed.solitary()로 자동 Mock 생성
 * - GWT: Given/When/Then 주석으로 테스트 구조화
 *
 * @see https://docs.nestjs.com/recipes/suites
 */

import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import type { CurrentUserPayload } from "@/modules/auth/decorators";

import type {
	CreateTodoCategoryDto,
	DeleteTodoCategoryQueryDto,
	ReorderTodoCategoryDto,
	TodoCategoryIdParamDto,
	UpdateTodoCategoryDto,
} from "./dtos";
import { TodoCategoryController } from "./todo-category.controller";
import { TodoCategoryMapper } from "./todo-category.mapper";
import { TodoCategoryService } from "./todo-category.service";
import type {
	TodoCategoryEntity,
	TodoCategoryWithCount,
} from "./types/todo-category.types";

describe("TodoCategoryController — 할 일 카테고리 컨트롤러", () => {
	let controller: TodoCategoryController;
	let mockTodoCategoryService: Mocked<TodoCategoryService>;

	const mockUser: CurrentUserPayload = {
		userId: "user-123",
		email: "test@example.com",
		sessionId: "session-123",
		role: "USER",
	};

	const mockCategory: TodoCategoryEntity = {
		id: 1,
		userId: "user-123",
		name: "중요한 일",
		color: "#FFB3B3",
		sortOrder: 0,
		createdAt: new Date("2026-03-01T10:00:00Z"),
		updatedAt: new Date("2026-03-01T10:00:00Z"),
	};

	const mockCategoryWithCount: TodoCategoryWithCount = {
		...mockCategory,
		_count: { todos: 5 },
	};

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(
			TodoCategoryController,
		).compile();

		controller = unit;
		mockTodoCategoryService = unitRef.get(TodoCategoryService);
	});

	describe("getResourceLimit", () => {
		it("카테고리 리소스 제한 정보 조회를 서비스에 위임하고 결과를 반환해야 한다", async () => {
			// Given -리소스 제한 정보 서비스 응답이 준비되었을 때
			const resourceLimit = { categoryCount: 3, maxCount: 10 };
			mockTodoCategoryService.getResourceLimitInfo.mockResolvedValue(
				resourceLimit,
			);

			// When -getResourceLimit를 호출하면
			const result = await controller.getResourceLimit(mockUser);

			// Then -서비스에 userId를 전달하고 결과를 반환해야 한다
			expect(mockTodoCategoryService.getResourceLimitInfo).toHaveBeenCalledWith(
				mockUser.userId,
			);
			expect(result).toEqual({ categoryCount: 3, maxCount: 10 });
		});
	});

	describe("create", () => {
		it("카테고리 생성 요청을 서비스에 위임하고 매핑된 결과를 반환해야 한다", async () => {
			// Given -카테고리 생성 DTO와 서비스 응답이 준비되었을 때
			const dto = {
				name: "공부",
				color: "#4A90D9",
			} as unknown as CreateTodoCategoryDto;
			const createdCategory: TodoCategoryEntity = {
				...mockCategory,
				id: 3,
				name: "공부",
				color: "#4A90D9",
				sortOrder: 2,
			};
			mockTodoCategoryService.create.mockResolvedValue(createdCategory);

			// When -create를 호출하면
			const result = await controller.create(mockUser, dto);

			// Then -서비스에 userId, name, color를 전달하고 매핑된 결과를 반환해야 한다
			expect(mockTodoCategoryService.create).toHaveBeenCalledWith({
				userId: mockUser.userId,
				name: dto.name,
				color: dto.color,
			});
			expect(result).toEqual({
				message: "카테고리가 생성되었습니다.",
				category: TodoCategoryMapper.toResponse(createdCategory),
			});
		});
	});

	describe("findAll", () => {
		it("카테고리 목록 조회를 서비스에 위임하고 매핑된 결과를 반환해야 한다", async () => {
			// Given -카테고리 목록 서비스 응답이 준비되었을 때
			const categories: TodoCategoryWithCount[] = [
				mockCategoryWithCount,
				{
					...mockCategory,
					id: 2,
					name: "할 일",
					color: "#FF6B43",
					sortOrder: 1,
					_count: { todos: 3 },
				},
			];
			mockTodoCategoryService.findMany.mockResolvedValue(categories);

			// When -findAll을 호출하면
			const result = await controller.findAll(mockUser);

			// Then -서비스에 userId를 전달하고 매핑된 결과를 반환해야 한다
			expect(mockTodoCategoryService.findMany).toHaveBeenCalledWith(
				mockUser.userId,
			);
			expect(result).toEqual({
				items: TodoCategoryMapper.toManyResponseWithCount(categories),
			});
		});
	});

	describe("findOne", () => {
		it("카테고리 상세 조회를 서비스에 위임하고 매핑된 결과를 반환해야 한다", async () => {
			// Given -조회할 카테고리 ID가 있을 때
			const params = { id: 1 } as unknown as TodoCategoryIdParamDto;
			mockTodoCategoryService.findById.mockResolvedValue(mockCategoryWithCount);

			// When -findOne을 호출하면
			const result = await controller.findOne(mockUser, params);

			// Then -서비스에 id와 userId를 전달하고 매핑된 결과를 반환해야 한다
			expect(mockTodoCategoryService.findById).toHaveBeenCalledWith(
				params.id,
				mockUser.userId,
			);
			expect(result).toEqual({
				category: TodoCategoryMapper.toResponseWithCount(mockCategoryWithCount),
			});
		});
	});

	describe("update", () => {
		it("카테고리 수정 요청을 서비스에 위임하고 매핑된 결과를 반환해야 한다", async () => {
			// Given -카테고리 수정 DTO와 서비스 응답이 준비되었을 때
			const params = { id: 1 } as unknown as TodoCategoryIdParamDto;
			const dto = {
				name: "매우 중요한 일",
				color: "#FF0000",
			} as unknown as UpdateTodoCategoryDto;
			const updatedCategory: TodoCategoryEntity = {
				...mockCategory,
				name: "매우 중요한 일",
				color: "#FF0000",
				updatedAt: new Date("2026-03-02T10:00:00Z"),
			};
			mockTodoCategoryService.update.mockResolvedValue(updatedCategory);

			// When -update를 호출하면
			const result = await controller.update(mockUser, params, dto);

			// Then -서비스에 id, userId, dto를 전달하고 매핑된 결과를 반환해야 한다
			expect(mockTodoCategoryService.update).toHaveBeenCalledWith(
				params.id,
				mockUser.userId,
				dto,
			);
			expect(result).toEqual({
				message: "카테고리가 수정되었습니다.",
				category: TodoCategoryMapper.toResponse(updatedCategory),
			});
		});
	});

	describe("reorder", () => {
		it("카테고리 순서 변경 요청을 서비스에 위임하고 매핑된 결과를 반환해야 한다", async () => {
			// Given -카테고리 순서 변경 DTO와 서비스 응답이 준비되었을 때
			const params = { id: 3 } as unknown as TodoCategoryIdParamDto;
			const dto = {
				targetCategoryId: 1,
				position: "before",
			} as unknown as ReorderTodoCategoryDto;
			const reorderedCategory: TodoCategoryEntity = {
				...mockCategory,
				id: 3,
				name: "공부",
				sortOrder: 0,
			};
			mockTodoCategoryService.reorder.mockResolvedValue(reorderedCategory);

			// When -reorder를 호출하면
			const result = await controller.reorder(mockUser, params, dto);

			// Then -서비스에 올바른 파라미터를 전달하고 매핑된 결과를 반환해야 한다
			expect(mockTodoCategoryService.reorder).toHaveBeenCalledWith({
				userId: mockUser.userId,
				categoryId: params.id,
				targetCategoryId: dto.targetCategoryId,
				position: dto.position,
			});
			expect(result).toEqual({
				message: "카테고리 순서가 변경되었습니다.",
				category: TodoCategoryMapper.toResponse(reorderedCategory),
			});
		});
	});

	describe("delete", () => {
		it("카테고리 삭제 요청을 서비스에 위임하고 메시지를 반환해야 한다", async () => {
			// Given -삭제할 카테고리 ID가 있을 때
			const params = { id: 3 } as unknown as TodoCategoryIdParamDto;
			const query = {
				moveToCategoryId: 1,
			} as unknown as DeleteTodoCategoryQueryDto;
			mockTodoCategoryService.delete.mockResolvedValue(undefined);

			// When -delete를 호출하면
			const result = await controller.delete(mockUser, params, query);

			// Then -서비스에 userId, categoryId, moveToCategoryId를 전달하고 메시지를 반환해야 한다
			expect(mockTodoCategoryService.delete).toHaveBeenCalledWith({
				userId: mockUser.userId,
				categoryId: params.id,
				moveToCategoryId: query.moveToCategoryId,
			});
			expect(result).toEqual({
				message: "카테고리가 삭제되었습니다.",
			});
		});

		it("moveToCategoryId 없이도 삭제할 수 있어야 한다", async () => {
			// Given -할 일이 없는 카테고리를 삭제할 때
			const params = { id: 3 } as unknown as TodoCategoryIdParamDto;
			const query = {
				moveToCategoryId: undefined,
			} as unknown as DeleteTodoCategoryQueryDto;
			mockTodoCategoryService.delete.mockResolvedValue(undefined);

			// When -delete를 호출하면
			const result = await controller.delete(mockUser, params, query);

			// Then -moveToCategoryId가 undefined로 전달되어야 한다
			expect(mockTodoCategoryService.delete).toHaveBeenCalledWith({
				userId: mockUser.userId,
				categoryId: params.id,
				moveToCategoryId: undefined,
			});
			expect(result).toEqual({
				message: "카테고리가 삭제되었습니다.",
			});
		});
	});
});
