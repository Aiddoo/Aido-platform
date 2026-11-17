import type { SupportedLocale } from "@aido/api/vocabulary";
import type { ReactElement } from "react";
import { render, toPlainText } from "react-email";
import { match } from "ts-pattern";

import type {
  EmailTemplate,
  RenderedEmail,
} from "../../application/ports/email-template-renderer.port.js";
import { EMAIL_COPY, formatEmailText } from "./email-copy.messages.js";
import InquiryEmail from "./inquiry.email.js";
import UserReportEmail from "./user-report.email.js";
import VerificationCodeEmail from "./verification-code.email.js";

interface EmailRenderOptions {
  readonly locale: SupportedLocale;
  readonly supportEmail: string;
}

interface EmailContent {
  readonly subject: string;
  readonly element: ReactElement;
}

// 텍스트 본문의 제목을 대문자로 바꾸지 않는다(영문 제목이 소리치듯 읽힌다)
const PLAIN_TEXT_OPTIONS = { selectors: [{ selector: "h1", options: { uppercase: false } }] };

function contentOf(template: EmailTemplate, options: EmailRenderOptions): EmailContent {
  const { locale, supportEmail } = options;
  const copy = EMAIL_COPY[locale];
  return match(template)
    .with(
      { kind: "verification" },
      { kind: "password-reset" },
      { kind: "password-setup" },
      ({ kind, data }) => ({
        subject: copy.code[kind].subject,
        element: (
          <VerificationCodeEmail
            locale={locale}
            kind={kind}
            supportEmail={supportEmail}
            {...data}
          />
        ),
      }),
    )
    .with({ kind: "inquiry" }, ({ data }) => ({
      subject: formatEmailText(copy.inquiry.subject, { categoryLabel: data.categoryLabel }),
      element: <InquiryEmail locale={locale} supportEmail={supportEmail} {...data} />,
    }))
    .with({ kind: "user-report" }, ({ data }) => ({
      subject: formatEmailText(copy["user-report"].subject, {
        reasonLabel: data.reasonLabel,
        targetTypeLabel: data.targetTypeLabel,
        targetUserTag: data.targetUserTag,
      }),
      element: <UserReportEmail locale={locale} supportEmail={supportEmail} {...data} />,
    }))
    .exhaustive();
}

export async function renderEmailElement(
  element: ReactElement,
): Promise<Omit<RenderedEmail, "subject">> {
  const html = await render(element);
  return { html, text: toPlainText(html, PLAIN_TEXT_OPTIONS) };
}

export async function renderEmail(
  template: EmailTemplate,
  options: EmailRenderOptions,
): Promise<RenderedEmail> {
  const { subject, element } = contentOf(template, options);
  return { subject, ...(await renderEmailElement(element)) };
}
