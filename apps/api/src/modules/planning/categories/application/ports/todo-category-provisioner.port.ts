import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import type { SupportedLocale } from "#api/shared/domain/locale";

export abstract class TodoCategoryProvisionerPort {
  /** 언어를 모르면(Accept-Language가 없는 구 앱) 기본 언어 이름으로 만든다. */
  abstract seed(userId: UserId, locale?: SupportedLocale): Promise<number>;
}
