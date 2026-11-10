import { Inject, Injectable } from "@nestjs/common";

import { UserSettingsProvisionerPort } from "#api/modules/identity/identity-settings.public";
import { TodoCategoryProvisionerPort } from "#api/modules/planning/categories/planning-categories.public";
import type { SupportedLocale } from "#api/shared/domain/locale";

import type {
  ProvisioningConsent,
  UserProvisioningSeederPort,
} from "../../application/ports/user-provisioning-seeder.port.js";

/**
 * UserProvisioningSeederPort 어댑터 — 설정과 기본 카테고리 생성을 조정한다.
 * 호출측이 연 CLS 트랜잭션에 참여하며 기본 상태만 생성한다.
 */
@Injectable()
export class UserProvisioningSeederAdapter implements UserProvisioningSeederPort {
  readonly #userSettingsProvisioner: UserSettingsProvisionerPort;
  readonly #categoryProvisioner: TodoCategoryProvisionerPort;

  constructor(
    @Inject(UserSettingsProvisionerPort)
    userSettingsProvisioner: UserSettingsProvisionerPort,
    @Inject(TodoCategoryProvisionerPort)
    categoryProvisioner: TodoCategoryProvisionerPort,
  ) {
    this.#userSettingsProvisioner = userSettingsProvisioner;
    this.#categoryProvisioner = categoryProvisioner;
  }

  seedDefaultSettings(userId: string, consent: ProvisioningConsent): Promise<void> {
    return this.#userSettingsProvisioner.seedDefaults(userId, consent);
  }

  async seedDefaultCategories(userId: string, locale?: SupportedLocale): Promise<void> {
    await this.#categoryProvisioner.seed(userId, locale);
  }
}
