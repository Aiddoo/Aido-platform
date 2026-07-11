import { Injectable } from "@nestjs/common";

import { TodoCategoryFacade } from "@/todo-category";
import { UserSettingsFacade } from "@/user-settings";
import type {
	ProvisioningConsent,
	UserProvisioningSeederPort,
} from "../../application/ports/user-provisioning-seeder.port";

/**
 * UserProvisioningSeederPort 어댑터 — UserSettingsFacade·TodoCategoryFacade에 위임한다.
 * auth → user-settings·todo-category 단방향 의존을 파사드 배럴 경유로만 유지한다.
 */
@Injectable()
export class UserProvisioningSeederAdapter
	implements UserProvisioningSeederPort
{
	constructor(
		private readonly userSettings: UserSettingsFacade,
		private readonly todoCategory: TodoCategoryFacade,
	) {}

	seedDefaultSettings(
		userId: string,
		consent: ProvisioningConsent,
	): Promise<void> {
		return this.userSettings.seedDefaults(userId, consent);
	}

	seedDefaultCategories(userId: string): Promise<void> {
		return this.todoCategory.seedDefaultCategories(userId);
	}
}
