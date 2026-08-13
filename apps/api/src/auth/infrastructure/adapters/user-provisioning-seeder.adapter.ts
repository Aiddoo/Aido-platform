import { Injectable } from "@nestjs/common";

import { DEFAULT_CATEGORIES, TodoCategoryRepository } from "@/todo-category";
import { UserSettingsFacade } from "@/user-settings";
import type {
	ProvisioningConsent,
	UserProvisioningSeederPort,
} from "../../application/ports/user-provisioning-seeder.port";

/**
 * UserProvisioningSeederPort 어댑터 — 설정과 기본 카테고리 생성을 조정한다.
 * 호출측이 연 CLS 트랜잭션에 참여하며 기본 상태만 생성한다.
 */
@Injectable()
export class UserProvisioningSeederAdapter
	implements UserProvisioningSeederPort
{
	constructor(
		private readonly userSettings: UserSettingsFacade,
		private readonly todoCategoryRepository: TodoCategoryRepository,
	) {}

	seedDefaultSettings(
		userId: string,
		consent: ProvisioningConsent,
	): Promise<void> {
		return this.userSettings.seedDefaults(userId, consent);
	}

	async seedDefaultCategories(userId: string): Promise<void> {
		await this.todoCategoryRepository.createMany(
			DEFAULT_CATEGORIES.map((category) => ({
				userId,
				name: category.name,
				color: category.color,
				sortOrder: category.sortOrder,
			})),
		);
	}
}
