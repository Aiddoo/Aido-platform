import type { SupportedLocale } from "#api/shared/domain/locale";

// 옛 Symbol 토큰. 소비 Context가 클래스 토큰으로 옮길 때까지 같은 인스턴스 별칭으로 남긴다
export const TODO_CATEGORY_PROVISIONER = Symbol("TODO_CATEGORY_PROVISIONER");

export abstract class TodoCategoryProvisionerPort {
  /** 언어를 모르면(Accept-Language가 없는 구 앱) 기본 언어 이름으로 만든다. */
  abstract seed(userId: string, locale?: SupportedLocale): Promise<number>;
}
