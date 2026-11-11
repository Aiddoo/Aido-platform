import type koErrors from "../../i18n/ko/errors.json";
import type koNotification from "../../i18n/ko/notification.json";

/** 기준 언어 ko 카탈로그 모양. 없는 키·빠진 `count`는 컴파일 오류가 된다. */
interface Translations {
  readonly errors: typeof koErrors;
  readonly notification: typeof koNotification;
}

declare module "@nestjs/i18n" {
  interface I18nTypes {
    translations: Translations;
  }
}
