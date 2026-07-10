import { Injectable } from "@nestjs/common";

import type { TodoCategory } from "../../domain/entities/todo-category.entity";
import type { TodoCategoryWithCountView } from "../ports/todo-category.repository.port";
import {
	type ResourceLimitInfo,
	TodoCategoryReader,
} from "../services/todo-category.reader";
import {
	type CreateTodoCategoryInput,
	CreateTodoCategoryUseCase,
} from "../use-cases/create-todo-category/create-todo-category.use-case";
import {
	type DeleteTodoCategoryInput,
	DeleteTodoCategoryUseCase,
} from "../use-cases/delete-todo-category/delete-todo-category.use-case";
import {
	type ReorderTodoCategoryInput,
	ReorderTodoCategoryUseCase,
} from "../use-cases/reorder-todo-category/reorder-todo-category.use-case";
import {
	type UpdateTodoCategoryInput,
	UpdateTodoCategoryUseCase,
} from "../use-cases/update-todo-category/update-todo-category.use-case";

/**
 * TodoCategoryFacade — todo-category 모듈의 유일한 공개 표면.
 * 컨트롤러·크로스모듈(todo·ai)은 이 파사드만 주입하며, use-case·reader에 직접 위임한다(버스 없음).
 */
@Injectable()
export class TodoCategoryFacade {
	constructor(
		private readonly reader: TodoCategoryReader,
		private readonly createUseCase: CreateTodoCategoryUseCase,
		private readonly updateUseCase: UpdateTodoCategoryUseCase,
		private readonly deleteUseCase: DeleteTodoCategoryUseCase,
		private readonly reorderUseCase: ReorderTodoCategoryUseCase,
	) {}

	getResourceLimitInfo(userId: string): Promise<ResourceLimitInfo> {
		return this.reader.getResourceLimitInfo(userId);
	}

	create(input: CreateTodoCategoryInput): Promise<TodoCategory> {
		return this.createUseCase.execute(input);
	}

	findMany(userId: string): Promise<TodoCategoryWithCountView[]> {
		return this.reader.findMany(userId);
	}

	findById(id: number, userId: string): Promise<TodoCategoryWithCountView> {
		return this.reader.findById(id, userId);
	}

	update(
		id: number,
		userId: string,
		data: UpdateTodoCategoryInput,
	): Promise<TodoCategory> {
		return this.updateUseCase.execute(id, userId, data);
	}

	reorder(input: ReorderTodoCategoryInput): Promise<TodoCategory> {
		return this.reorderUseCase.execute(input);
	}

	delete(input: DeleteTodoCategoryInput): Promise<void> {
		return this.deleteUseCase.execute(input);
	}

	/** 크로스모듈(todo): 카테고리 소유권 검증(미소유·부재 시 예외) */
	validateOwnership(id: number, userId: string): Promise<void> {
		return this.reader.validateOwnership(id, userId);
	}

	/** 크로스모듈(ai): 사용자 카테고리 목록(비캐시) */
	listForUser(userId: string): Promise<TodoCategoryWithCountView[]> {
		return this.reader.listForUser(userId);
	}
}
