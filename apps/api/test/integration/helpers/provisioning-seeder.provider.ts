/**
 * 통합 테스트용 UserProvisioningSeederPort 프로바이더.
 *
 * 프로덕션에서는 UserProvisioningSeederAdapter가 설정·기본 카테고리 생성 경계에
 * 위임하지만, 통합 테스트는 파사드 전체 그래프를 조립하지 않고 실제 저장소(실 DB)에 직접
 * 위임하는 경량 시더를 제공하여 회원가입 시딩 부수효과(동의·설정·기본 카테고리)를 그대로 재현한다.
 * (프로덕션 seedDefaults/seedDefaultCategories와 동일한 호출 시퀀스)
 */

import type { Provider } from "@nestjs/common";

import {
  type ProvisioningConsent,
  UserProvisioningSeederPort,
} from "#api/modules/identity/auth/application/ports/user-provisioning-seeder.port";
import { DrizzleUserConsentRepository } from "#api/modules/identity/preferences/infrastructure/persistence/drizzle-user-consent.repository";
import { DrizzleUserPreferenceRepository } from "#api/modules/identity/preferences/infrastructure/persistence/drizzle-user-preference.repository";
import { DefaultTodoCategoryProvisionerAdapter } from "#api/modules/planning/categories/infrastructure/adapters/default-todo-category-provisioner.adapter";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

export const provisioningSeederTestProvider: Provider = {
  provide: UserProvisioningSeederPort,
  useFactory: (
    consentRepository: DrizzleUserConsentRepository,
    preferenceRepository: DrizzleUserPreferenceRepository,
    defaultTodoCategorySeeder: DefaultTodoCategoryProvisionerAdapter,
  ): UserProvisioningSeederPort => ({
    async seedDefaultSettings(userId: UserId, consent: ProvisioningConsent): Promise<void> {
      await consentRepository.create(userId, consent);
      await preferenceRepository.create(userId, {
        pushEnabled: true,
        nightPushEnabled: true,
      });
    },
    async seedDefaultCategories(userId, locale): Promise<void> {
      await defaultTodoCategorySeeder.seed(userId, locale);
    },
  }),
  inject: [
    DrizzleUserConsentRepository,
    DrizzleUserPreferenceRepository,
    DefaultTodoCategoryProvisionerAdapter,
  ],
};
