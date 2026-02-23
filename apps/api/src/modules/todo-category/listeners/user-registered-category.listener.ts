import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";

import {
	AdminNotificationEvents,
	type UserRegisteredEventPayload,
} from "@/modules/admin-notification/events/admin-notification.events";

import { TodoCategoryRepository } from "../todo-category.repository";
import { DEFAULT_CATEGORIES } from "../types/todo-category.types";

/**
 * 회원가입 시 기본 카테고리 생성 리스너
 *
 * AuthService/OAuthService에서 발행하는 user.registered 이벤트를 수신하여
 * 기본 카테고리("중요한 일", "할 일")를 생성합니다.
 *
 * 이벤트 기반이므로 카테고리 생성 실패가 회원가입을 롤백하지 않습니다.
 * Idempotent: 이미 카테고리가 존재하면 생성하지 않습니다.
 */
@Injectable()
export class UserRegisteredCategoryListener {
	readonly #logger = new Logger(UserRegisteredCategoryListener.name);

	constructor(
		private readonly todoCategoryRepository: TodoCategoryRepository,
	) {}

	@OnEvent(AdminNotificationEvents.USER_REGISTERED)
	async handleUserRegistered(
		payload: UserRegisteredEventPayload,
	): Promise<void> {
		this.#logger.debug(
			`Creating default categories for new user: ${payload.userId}`,
		);

		try {
			// Idempotent: 이미 카테고리가 존재하면 건너뜀
			const existingCount = await this.todoCategoryRepository.countByUserId(
				payload.userId,
			);
			if (existingCount > 0) {
				this.#logger.debug(
					`User ${payload.userId} already has ${existingCount} categories, skipping`,
				);
				return;
			}

			await this.todoCategoryRepository.createMany(
				DEFAULT_CATEGORIES.map((category) => ({
					userId: payload.userId,
					name: category.name,
					color: category.color,
					sortOrder: category.sortOrder,
				})),
			);

			this.#logger.log(
				`Default categories created for user: ${payload.userId}`,
			);
		} catch (error) {
			// 카테고리 생성 실패가 회원가입을 방해하면 안 됨
			this.#logger.error(
				`Failed to create default categories for user ${payload.userId}: ${error}`,
				error instanceof Error ? error.stack : undefined,
			);
		}
	}
}
