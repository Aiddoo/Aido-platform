import type { ErrorCodeType } from "@aido/api/errors";
import { Injectable } from "@nestjs/common";
import { I18nService } from "@nestjs/i18n";

import "./i18n-translations.js";

/** 오류 코드의 기본 문구를 현재 요청 언어로 꺼낸다. 요청 밖이나 언어를 정하기 전이면 ko다. */
@Injectable()
export class ErrorMessageTranslator {
  readonly #i18n: I18nService;

  constructor(i18n: I18nService) {
    this.#i18n = i18n;
  }

  translate(code: ErrorCodeType): string {
    return this.#i18n.t(`errors.${code}`);
  }
}
