import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from "@aido/api/vocabulary";
import { Global, Module } from "@nestjs/common";
import { I18nModule, JsonI18nLoader } from "@nestjs/i18n";

import { ErrorMessageTranslator } from "./error-message.translator.js";
import { I18N_CATALOG_PATH } from "./i18n-catalog-path.js";
import { RequestClientLocaleResolver } from "./request-client-locale.resolver.js";

/**
 * 서버 문구 카탈로그(`src/i18n/<locale>/<namespace>.json`)와 요청 언어를 정한다.
 * `@nestjs/i18n`(0.0.x)은 이 폴더 밖에서 직접 쓰지 않는다.
 */
@Global()
@Module({
  imports: [
    I18nModule.forRoot({
      loader: new JsonI18nLoader({ path: I18N_CATALOG_PATH }),
      resolvers: [new RequestClientLocaleResolver()],
      defaultLocale: DEFAULT_LOCALE,
      supportedLocales: [...SUPPORTED_LOCALES],
      missingKey: "fallback",
      // 출시 응답 헤더(Content-Language·Vary)를 바꾸지 않는다
      responseHeaders: false,
    }),
  ],
  providers: [ErrorMessageTranslator],
  exports: [ErrorMessageTranslator],
})
export class AppI18nModule {}
