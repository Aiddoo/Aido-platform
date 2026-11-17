import type { SupportedLocale } from "@aido/api/vocabulary";
import type { CSSProperties } from "react";
import { Heading, Hr, Section, Text } from "react-email";

import type { VerificationCodeTemplateData } from "../../application/ports/email-template-renderer.port.js";
import type { EmailKind } from "../../domain/email-delivery.constants.js";
import { EMAIL_CODE_FONT_FAMILY, EMAIL_COLORS } from "./email-brand.constants.js";
import { EMAIL_COPY, formatEmailText, formatMinutes } from "./email-copy.messages.js";
import { EmailLayout } from "./email-layout.js";

type VerificationCodeEmailKind = Extract<
  EmailKind,
  "verification" | "password-reset" | "password-setup"
>;

interface VerificationCodeEmailProps extends VerificationCodeTemplateData {
  readonly locale: SupportedLocale;
  readonly kind: VerificationCodeEmailKind;
  readonly supportEmail: string;
}

const CODE_LETTER_SPACING_PX = 8;

const styles = {
  title: {
    margin: "0 0 12px",
    fontSize: "24px",
    lineHeight: "32px",
    fontWeight: 700,
    color: EMAIL_COLORS.ink,
  },
  intro: { margin: "0 0 24px", fontSize: "16px", lineHeight: "26px", color: EMAIL_COLORS.ink },
  codeBox: {
    backgroundColor: EMAIL_COLORS.brandSoft,
    borderRadius: "16px",
    padding: "20px 16px 24px",
    textAlign: "center",
  },
  codeLabel: {
    margin: "0 0 8px",
    fontSize: "13px",
    lineHeight: "20px",
    fontWeight: 600,
    color: EMAIL_COLORS.ink,
  },
  code: {
    margin: 0,
    // 글자 사이 간격이 마지막 글자 뒤에도 붙어 같은 너비를 앞에 두어 가운데를 맞춘다
    paddingLeft: `${CODE_LETTER_SPACING_PX}px`,
    fontFamily: EMAIL_CODE_FONT_FAMILY,
    fontSize: "34px",
    lineHeight: "44px",
    fontWeight: 700,
    letterSpacing: `${CODE_LETTER_SPACING_PX}px`,
    color: EMAIL_COLORS.ink,
  },
  expiry: { margin: "16px 0 0", fontSize: "14px", lineHeight: "22px", color: EMAIL_COLORS.muted },
  divider: { margin: "24px 0", borderTop: `1px solid ${EMAIL_COLORS.line}` },
  ignore: { margin: 0, fontSize: "14px", lineHeight: "22px", color: EMAIL_COLORS.muted },
} satisfies Record<string, CSSProperties>;

// 인증·비밀번호 재설정·비밀번호 설정 코드 메일은 문구만 다르고 모양이 같다
export default function VerificationCodeEmail({
  locale,
  kind,
  code,
  expiryMinutes,
  supportEmail,
}: VerificationCodeEmailProps) {
  const copy = EMAIL_COPY[locale].code;
  const kindCopy = copy[kind];
  const duration = formatMinutes(expiryMinutes, locale);
  return (
    <EmailLayout
      locale={locale}
      preview={formatEmailText(kindCopy.preview, { duration })}
      supportEmail={supportEmail}
    >
      <Heading as="h1" style={styles.title}>
        {kindCopy.title}
      </Heading>
      <Text style={styles.intro}>{kindCopy.intro}</Text>
      <Section style={styles.codeBox}>
        <Text style={styles.codeLabel}>{copy.label}</Text>
        <Text style={styles.code}>{code}</Text>
      </Section>
      <Text style={styles.expiry}>{formatEmailText(copy.expiry, { duration })}</Text>
      <Hr style={styles.divider} />
      <Text style={styles.ignore}>{kindCopy.ignore}</Text>
    </EmailLayout>
  );
}

VerificationCodeEmail.PreviewProps = {
  locale: "ko",
  kind: "verification",
  code: "482916",
  expiryMinutes: 10,
  supportEmail: "support@aido.kr",
} satisfies VerificationCodeEmailProps;
