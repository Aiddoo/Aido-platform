import { Injectable, Logger } from "@nestjs/common";
import { BusinessExceptions } from "@/common/exception/services/business-exception.service";
import { DatabaseService } from "@/database/database.service";
import type { TodoCategory } from "@/generated/prisma/client";

import { TodoCategoryRepository } from "./todo-category.repository";
import type {
	CreateTodoCategoryData,
	DEFAULT_CATEGORIES,
	DeleteTodoCategoryParams,
	ReorderTodoCategoryParams,
	TodoCategoryWithCount,
	UpdateTodoCategoryData,
} from "./types/todo-category.types";

@Injectable()
export class TodoCategoryService {
	private readonly logger = new Logger(TodoCategoryService.name);

	constructor(
		private readonly todoCategoryRepository: TodoCategoryRepository,
		private readonly database: DatabaseService,
	) {}

	/**
	 * 카테고리 생성
	 */
	async create(data: CreateTodoCategoryData): Promise<TodoCategory> {
		// 동일 이름 존재 확인
		const exists = await this.todoCategoryRepository.existsByUserIdAndName(
			data.userId,
			data.name,
		);

		if (exists) {
			throw BusinessExceptions.todoCategoryNameDuplicate(data.name);
		}

		// 최대 sortOrder + 1로 새 카테고리 생성
		const maxSortOrder = await this.todoCategoryRepository.getMaxSortOrder(
			data.userId,
		);

		const category = await this.todoCategoryRepository.create({
			user: { connect: { id: data.userId } },
			name: data.name,
			color: data.color,
			sortOrder: maxSortOrder + 1,
		});

		this.logger.log(
			`TodoCategory created: ${category.id} for user: ${data.userId}`,
		);

		return category;
	}

	/**
	 * 기본 카테고리 생성 (회원가입 시 호출)
	 */
	async createDefaultCategories(
		userId: string,
		categories: typeof DEFAULT_CATEGORIES,
	): Promise<number> {
		const data = categories.map((cat) => ({
			userId,
			name: cat.name,
			color: cat.color,
			sortOrder: cat.sortOrder,
		}));

		const count = await this.todoCategoryRepository.createMany(data);

		this.logger.log(`Default categories created: ${count} for user: ${userId}`);

		return count;
	}

	/**
	 * 단일 카테고리 조회
	 */
	async findById(id: number, userId: string): Promise<TodoCategoryWithCount> {
		const category = await this.todoCategoryRepository.findByIdWithCount(id);

		if (!category) {
			throw BusinessExceptions.todoCategoryNotFound(id);
		}

		if (category.userId !== userId) {
			throw BusinessExceptions.todoCategoryAccessDenied(id);
		}

		this.logger.debug(`TodoCategory retrieved: ${id} for user: ${userId}`);

		return category;
	}

	/**
	 * 카테고리 목록 조회 (Todo 개수 포함)
	 */
	async findMany(userId: string): Promise<TodoCategoryWithCount[]> {
		const categories =
			await this.todoCategoryRepository.findManyByUserId(userId);

		this.logger.debug(
			`TodoCategories listed: ${categories.length} items for user: ${userId}`,
		);

		return categories;
	}

	/**
	 * 카테고리 수정
	 */
	async update(
		id: number,
		userId: string,
		data: UpdateTodoCategoryData,
	): Promise<TodoCategory> {
		const category = await this.todoCategoryRepository.findByIdAndUserId(
			id,
			userId,
		);

		if (!category) {
			throw BusinessExceptions.todoCategoryNotFound(id);
		}

		// 이름 변경 시 중복 확인
		if (data.name && data.name !== category.name) {
			const exists = await this.todoCategoryRepository.existsByUserIdAndName(
				userId,
				data.name,
				id, // 자기 자신은 제외
			);

			if (exists) {
				throw BusinessExceptions.todoCategoryNameDuplicate(data.name);
			}
		}

		const updatedCategory = await this.todoCategoryRepository.update(id, data);

		this.logger.log(`TodoCategory updated: ${id} for user: ${userId}`);

		return updatedCategory;
	}

	/**
	 * 카테고리 삭제
	 *
	 * 규칙:
	 * - 최소 1개의 카테고리 필요
	 * - 카테고리에 Todo가 있으면 moveToCategoryId로 이동 필수
	 */
	async delete(params: DeleteTodoCategoryParams): Promise<void> {
		const { userId, categoryId, moveToCategoryId } = params;

		await this.database.$transaction(async (tx) => {
			// 1. 카테고리 존재 확인
			const category = await this.todoCategoryRepository.findByIdAndUserId(
				categoryId,
				userId,
				tx,
			);

			if (!category) {
				throw BusinessExceptions.todoCategoryNotFound(categoryId);
			}

			// 2. 카테고리 개수 확인 (최소 1개 유지)
			const categoryCount = await this.todoCategoryRepository.countByUserId(
				userId,
				tx,
			);

			if (categoryCount <= 1) {
				throw BusinessExceptions.todoCategoryMinimumRequired();
			}

			// 3. 해당 카테고리의 Todo 개수 확인
			const todoCount = await this.todoCategoryRepository.getTodoCount(
				categoryId,
				tx,
			);

			if (todoCount > 0) {
				// Todo가 있으면 이동 대상 카테고리 필수
				if (!moveToCategoryId) {
					throw BusinessExceptions.todoCategoryMoveTargetRequired();
				}

				// 이동 대상 카테고리 확인
				const targetCategory =
					await this.todoCategoryRepository.findByIdAndUserId(
						moveToCategoryId,
						userId,
						tx,
					);

				if (!targetCategory) {
					throw BusinessExceptions.todoCategoryNotFound(moveToCategoryId);
				}

				// Todo 이동
				await this.todoCategoryRepository.moveTodosToCategory(
					categoryId,
					moveToCategoryId,
					tx,
				);

				this.logger.log(
					`Moved ${todoCount} todos from category ${categoryId} to ${moveToCategoryId}`,
				);
			}

			// 4. 카테고리 삭제
			await this.todoCategoryRepository.delete(categoryId, tx);

			this.logger.log(
				`TodoCategory deleted: ${categoryId} for user: ${userId}`,
			);
		});
	}

	/**
	 * 카테고리 순서 변경 (개별 이동)
	 *
	 * targetCategoryId의 before/after 위치로 이동
	 * targetCategoryId가 없으면 맨 앞/뒤로 이동
	 */
	async reorder(params: ReorderTodoCategoryParams): Promise<TodoCategory> {
		const { userId, categoryId, targetCategoryId, position } = params;

		return this.database.$transaction(async (tx) => {
			// 1. 이동할 카테고리 확인
			const category = await this.todoCategoryRepository.findByIdAndUserId(
				categoryId,
				userId,
				tx,
			);

			if (!category) {
				throw BusinessExceptions.todoCategoryNotFound(categoryId);
			}

			const currentSortOrder = category.sortOrder;
			let newSortOrder: number;

			if (targetCategoryId) {
				// 2a. 특정 카테고리 기준으로 이동
				const targetCategory =
					await this.todoCategoryRepository.findByIdAndUserId(
						targetCategoryId,
						userId,
						tx,
					);

				if (!targetCategory) {
					throw BusinessExceptions.todoCategoryNotFound(targetCategoryId);
				}

				// 같은 카테고리면 무시
				if (categoryId === targetCategoryId) {
					return category;
				}

				const targetSortOrder = targetCategory.sortOrder;

				if (position === "before") {
					newSortOrder = targetSortOrder;
				} else {
					newSortOrder = targetSortOrder + 1;
				}

				// 이동 방향에 따라 다른 카테고리들 shift
				if (currentSortOrder < newSortOrder) {
					// 아래로 이동: 사이 카테고리들을 위로 shift
					await this.todoCategoryRepository.shiftSortOrders(
						userId,
						currentSortOrder + 1,
						newSortOrder - 1,
						-1,
						tx,
					);
					newSortOrder -= 1;
				} else {
					// 위로 이동: 사이 카테고리들을 아래로 shift
					await this.todoCategoryRepository.shiftSortOrders(
						userId,
						newSortOrder,
						currentSortOrder - 1,
						1,
						tx,
					);
				}
			} else {
				// 2b. 맨 앞 또는 맨 뒤로 이동
				if (position === "before") {
					// 맨 앞으로
					newSortOrder = 0;
					await this.todoCategoryRepository.shiftSortOrders(
						userId,
						0,
						currentSortOrder - 1,
						1,
						tx,
					);
				} else {
					// 맨 뒤로
					const maxSortOrder =
						await this.todoCategoryRepository.getMaxSortOrder(userId, tx);
					newSortOrder = maxSortOrder;
					await this.todoCategoryRepository.shiftSortOrders(
						userId,
						currentSortOrder + 1,
						null,
						-1,
						tx,
					);
				}
			}

			// 3. 카테고리 sortOrder 업데이트
			const updatedCategory = await this.todoCategoryRepository.update(
				categoryId,
				{ sortOrder: newSortOrder },
				tx,
			);

			this.logger.log(
				`TodoCategory reordered: ${categoryId} -> sortOrder ${newSortOrder} for user: ${userId}`,
			);

			return updatedCategory;
		});
	}

	/**
	 * 카테고리 소유권 확인 (다른 서비스에서 사용)
	 */
	async validateOwnership(id: number, userId: string): Promise<TodoCategory> {
		const category = await this.todoCategoryRepository.findByIdAndUserId(
			id,
			userId,
		);

		if (!category) {
			throw BusinessExceptions.todoCategoryNotFound(id);
		}

		return category;
	}
}
