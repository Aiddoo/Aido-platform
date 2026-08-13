/**
 * 통합 테스트용 USER_PROVISIONING_SEEDER 프로바이더.
 *
 * 프로덕션에서는 UserProvisioningSeederAdapter가 설정·기본 카테고리 생성 경계에
 * 위임하지만, 통합 테스트는 파사드 전체 그래프를 조립하지 않고 실제 저장소(실 DB)에 직접
 * 위임하는 경량 시더를 제공하여 회원가입 시딩 부수효과(동의·설정·기본 카테고리)를 그대로 재현한다.
 * (프로덕션 seedDefaults/seedDefaultCategories와 동일한 호출 시퀀스)
 */

import type { Provider } from "@nestjs/common";

import {
	type ProvisioningConsent,
	USER_PROVISIONING_SEEDER,
	type UserProvisioningSeederPort,
} from "@/auth/application/ports/user-provisioning-seeder.port";
import { DEFAULT_CATEGORIES } from "@/todo-category";
import { TodoCategoryRepository } from "@/todo-category/todo-category.repository";
import { UserConsentRepository } from "@/user-settings/infrastructure/persistence/user-consent.repository";
import { UserPreferenceRepository } from "@/user-settings/infrastructure/persistence/user-preference.repository";

export const provisioningSeederTestProvider: Provider = {
	provide: USER_PROVISIONING_SEEDER,
	useFactory: (
		consentRepository: UserConsentRepository,
		preferenceRepository: UserPreferenceRepository,
		categoryRepository: TodoCategoryRepository,
	): UserProvisioningSeederPort => ({
		async seedDefaultSettings(
			userId: string,
			consent: ProvisioningConsent,
		): Promise<void> {
			await consentRepository.create(userId, consent);
			await preferenceRepository.create(userId, {
				pushEnabled: true,
				nightPushEnabled: true,
			});
		},
		async seedDefaultCategories(userId: string): Promise<void> {
			await categoryRepository.createMany(
				DEFAULT_CATEGORIES.map((category) => ({
					userId,
					name: category.name,
					color: category.color,
					sortOrder: category.sortOrder,
				})),
			);
		},
	}),
	inject: [
		UserConsentRepository,
		UserPreferenceRepository,
		TodoCategoryRepository,
	],
};
