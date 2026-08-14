import { Inject, Injectable } from "@nestjs/common";

import { DefaultTodoCategorySeeder } from "@/todo-category";
import {
	USER_SETTINGS_PROVISIONER,
	type UserSettingsProvisionerPort,
} from "@/user-settings";
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
		@Inject(USER_SETTINGS_PROVISIONER)
		private readonly userSettingsProvisioner: UserSettingsProvisionerPort,
		private readonly defaultTodoCategorySeeder: DefaultTodoCategorySeeder,
	) {}

	seedDefaultSettings(
		userId: string,
		consent: ProvisioningConsent,
	): Promise<void> {
		return this.userSettingsProvisioner.seedDefaults(userId, consent);
	}

	async seedDefaultCategories(userId: string): Promise<void> {
		await this.defaultTodoCategorySeeder.seed(userId);
	}
}
