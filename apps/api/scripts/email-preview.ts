/**
 * 메일 템플릿 미리보기. 메일 종류×언어마다 템플릿의 PreviewProps로 HTML·텍스트를 렌더해
 * apps/api/tmp/email-previews/<종류>.<언어>.{html,txt}에 쓴다(git이 무시하는 폴더).
 *   pnpm --filter @aido/server email:preview
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { SUPPORTED_LOCALES, type SupportedLocale } from "@aido/api/vocabulary";
import { createElement, type ReactElement } from "react";

import type { EmailKind } from "../src/modules/notification/email/domain/email-delivery.constants.js";
import { renderEmailElement } from "../src/modules/notification/email/infrastructure/templates/email-renderer.js";
import InquiryEmail from "../src/modules/notification/email/infrastructure/templates/inquiry.email.js";
import UserReportEmail from "../src/modules/notification/email/infrastructure/templates/user-report.email.js";
import VerificationCodeEmail from "../src/modules/notification/email/infrastructure/templates/verification-code.email.js";

const OUTPUT_DIRECTORY = join(import.meta.dirname, "../tmp/email-previews");

const PREVIEWS = {
  verification: (locale) =>
    createElement(VerificationCodeEmail, { ...VerificationCodeEmail.PreviewProps, locale }),
  "password-reset": (locale) =>
    createElement(VerificationCodeEmail, {
      ...VerificationCodeEmail.PreviewProps,
      kind: "password-reset",
      locale,
    }),
  "password-setup": (locale) =>
    createElement(VerificationCodeEmail, {
      ...VerificationCodeEmail.PreviewProps,
      kind: "password-setup",
      locale,
    }),
  inquiry: (locale) => createElement(InquiryEmail, { ...InquiryEmail.PreviewProps, locale }),
  "user-report": (locale) =>
    createElement(UserReportEmail, { ...UserReportEmail.PreviewProps, locale }),
} satisfies Record<EmailKind, (locale: SupportedLocale) => ReactElement>;

mkdirSync(OUTPUT_DIRECTORY, { recursive: true });
for (const [kind, preview] of Object.entries(PREVIEWS)) {
  for (const locale of SUPPORTED_LOCALES) {
    const { html, text } = await renderEmailElement(preview(locale));
    writeFileSync(join(OUTPUT_DIRECTORY, `${kind}.${locale}.html`), html);
    writeFileSync(join(OUTPUT_DIRECTORY, `${kind}.${locale}.txt`), text);
  }
}
console.log(`email previews: ${OUTPUT_DIRECTORY}`);
