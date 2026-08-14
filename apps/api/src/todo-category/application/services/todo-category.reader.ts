import { ErrorCode } from "@aido/errors";
import { Inject, Injectable } from "@nestjs/common";

import { EntitlementService, Resource } from "@/shared/application/entitlement/entitlement.service";
import { ApplicationException } from "@/shared/domain/exceptions/application.exception";

import { TODO_CATEGORY_CACHE, type TodoCategoryCachePort } from "../ports/todo-category-cache.port";
import {
	TODO_CATEGORY_REPOSITORY,
	type TodoCategoryRepositoryPort,
	type TodoCategoryWithCountView,
} from "../ports/todo-category.repository.port";

export interface ResourceLimitInfo {
	categoryCount: number;
	maxCount: number | null;
}

/**
 * TodoCategoryReader — 카테고리 읽기 전용 서비스.
 *
 * 목록(캐시 read-through)·단건·자원 한도 조회와 소유권 검증을 담당한다.
 */
@Injectable()
export class TodoCategoryReader {
	constructor(
		@Inject(TODO_CATEGORY_REPOSITORY)
		private readonly repository: TodoCategoryRepositoryPort,
		@Inject(TODO_CATEGORY_CACHE)
		private readonly cache: TodoCategoryCachePort,
		private readonly entitlementService: EntitlementService,
	) {}

	async getResourceLimitInfo(userId: string): Promise<ResourceLimitInfo> {
		const [entitlement, categoryCount] = await Promise.all([
			this.entitlementService.getResourceLimit(userId, Resource.CATEGORY),
			this.repository.countByUserId(userId),
		]);
		return { categoryCount, maxCount: entitlement.maxCount };
	}

	findMany(userId: string): Promise<TodoCategoryWithCountView[]> {
		return this.cache.wrapList(userId, () => this.repository.findManyByUserId(userId));
	}

	/** 캐시 없이 사용자 카테고리 목록을 읽는다. 타 모듈(ai) 크로스모듈 소비용(레거시 비캐시 경로 보존). */
	listForUser(userId: string): Promise<TodoCategoryWithCountView[]> {
		return this.repository.findManyByUserId(userId);
	}

	async findById(id: number, userId: string): Promise<TodoCategoryWithCountView> {
		const category = await this.repository.findByIdWithCount(id);
		if (!category) {
			throw new ApplicationException(ErrorCode.TODO_CATEGORY_0851, {
				categoryId: id,
			});
		}
		if (category.userId !== userId) {
			throw new ApplicationException(ErrorCode.TODO_CATEGORY_0852, {
				categoryId: id,
			});
		}
		return category;
	}

	/** 카테고리 소유권 검증(미소유·부재 시 예외). 타 모듈(todo)이 파사드로 소비한다. */
	async validateOwnership(id: number, userId: string): Promise<void> {
		const category = await this.repository.findByIdAndUserId(id, userId);
		if (!category) {
			throw new ApplicationException(ErrorCode.TODO_CATEGORY_0851, {
				categoryId: id,
			});
		}
	}
}
