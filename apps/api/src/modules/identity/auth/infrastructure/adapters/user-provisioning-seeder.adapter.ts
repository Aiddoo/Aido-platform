import { Inject, Injectable } from "@nestjs/common";

import {
  USER_SETTINGS_PROVISIONER,
  type UserSettingsProvisionerPort,
} from "#api/modules/identity/identity-settings.public";
import {
  TODO_CATEGORY_PROVISIONER,
  type TodoCategoryProvisionerPort,
} from "#api/modules/planning/categories/planning-categories.public";
import type { SupportedLocale } from "#api/shared/domain/locale";
import { instantToDate } from "#api/shared/domain/time/instant";

import type {
  ProvisioningConsent,
  UserProvisioningSeederPort,
} from "../../application/ports/user-provisioning-seeder.port.js";

// 설정 Context의 동의 칸은 아직 Date라 경계에서 바꾼다
function dateOrUndefined(instant: Temporal.Instant | undefined): Date | undefined {
  return instant == null ? undefined : instantToDate(instant);
}

/**
 * UserProvisioningSeederPort 어댑터 — 설정과 기본 카테고리 생성을 조정한다.
 * 호출측이 연 CLS 트랜잭션에 참여하며 기본 상태만 생성한다.
 */
@Injectable()
export class UserProvisioningSeederAdapter implements UserProvisioningSeederPort {
  readonly #userSettingsProvisioner: UserSettingsProvisionerPort;
  readonly #categoryProvisioner: TodoCategoryProvisionerPort;

  constructor(
    @Inject(USER_SETTINGS_PROVISIONER)
    userSettingsProvisioner: UserSettingsProvisionerPort,
    @Inject(TODO_CATEGORY_PROVISIONER)
    categoryProvisioner: TodoCategoryProvisionerPort,
  ) {
    this.#userSettingsProvisioner = userSettingsProvisioner;
    this.#categoryProvisioner = categoryProvisioner;
  }

  seedDefaultSettings(userId: string, consent: ProvisioningConsent): Promise<void> {
    return this.#userSettingsProvisioner.seedDefaults(userId, {
      termsAgreedAt: dateOrUndefined(consent.termsAgreedAt),
      privacyAgreedAt: dateOrUndefined(consent.privacyAgreedAt),
      agreedTermsVersion: consent.agreedTermsVersion,
      marketingAgreedAt: dateOrUndefined(consent.marketingAgreedAt),
      marketingPushAgreedAt: dateOrUndefined(consent.marketingPushAgreedAt),
    });
  }

  async seedDefaultCategories(userId: string, locale?: SupportedLocale): Promise<void> {
    await this.#categoryProvisioner.seed(userId, locale);
  }
}
