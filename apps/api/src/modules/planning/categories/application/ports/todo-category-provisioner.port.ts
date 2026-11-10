import type { SupportedLocale } from "#api/shared/domain/locale";

export const TODO_CATEGORY_PROVISIONER = Symbol("TODO_CATEGORY_PROVISIONER");

export interface TodoCategoryProvisionerPort {
  /** 언어를 모르면(Accept-Language가 없는 구 앱) 기본 언어 이름으로 만든다. */
  seed(userId: string, locale?: SupportedLocale): Promise<number>;
}
