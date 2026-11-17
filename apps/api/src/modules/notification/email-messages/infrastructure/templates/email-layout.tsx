import type { SupportedLocale } from "@aido/api/vocabulary";
import type { CSSProperties, ReactNode } from "react";
import {
  Body,
  Column,
  Container,
  Head,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from "react-email";

import {
  EMAIL_COLORS,
  EMAIL_FONT_FAMILY,
  EMAIL_LOGO_URL,
  emailLinksOf,
} from "./email-brand.constants.js";
import { EMAIL_COPY } from "./email-copy.messages.js";

interface EmailLayoutProps {
  readonly locale: SupportedLocale;
  readonly preview: string;
  readonly supportEmail: string;
  readonly children: ReactNode;
}

const LOGO_SIZE_PX = 40;

const styles = {
  body: {
    margin: 0,
    padding: "32px 12px",
    backgroundColor: EMAIL_COLORS.cream,
    fontFamily: EMAIL_FONT_FAMILY,
    color: EMAIL_COLORS.ink,
    WebkitTextSizeAdjust: "100%",
  },
  container: { width: "100%", maxWidth: "560px" },
  card: {
    backgroundColor: EMAIL_COLORS.paper,
    border: `1px solid ${EMAIL_COLORS.line}`,
    borderTop: `4px solid ${EMAIL_COLORS.brand}`,
    borderRadius: "20px",
    padding: "28px 28px 32px",
  },
  logo: { borderRadius: "12px" },
  brandName: {
    margin: 0,
    paddingLeft: "12px",
    fontSize: "18px",
    lineHeight: "24px",
    fontWeight: 700,
    color: EMAIL_COLORS.ink,
  },
  content: { paddingTop: "24px" },
  footer: { padding: "24px 8px 0", textAlign: "center" },
  footerText: {
    margin: 0,
    fontSize: "13px",
    lineHeight: "20px",
    color: EMAIL_COLORS.muted,
  },
  footerLink: {
    display: "inline-block",
    padding: "12px 2px",
    color: EMAIL_COLORS.brandDeep,
    textDecorationLine: "underline",
  },
} satisfies Record<string, CSSProperties>;

// 메일 앱이 어두운 화면으로 바꿔도 읽히도록 밝은 화면만 선언하고 배경을 모두 칠한다
export function EmailLayout({ locale, preview, supportEmail, children }: EmailLayoutProps) {
  const copy = EMAIL_COPY[locale].layout;
  const links = emailLinksOf(locale);
  return (
    <Html lang={locale} dir="ltr">
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="color-scheme" content="light" />
        <meta name="supported-color-schemes" content="light" />
      </Head>
      <Preview>{preview}</Preview>
      <Body lang={locale} style={styles.body}>
        <Container style={styles.container}>
          <Section style={styles.card}>
            <Row>
              <Column width={LOGO_SIZE_PX}>
                <Img
                  src={EMAIL_LOGO_URL}
                  width={LOGO_SIZE_PX}
                  height={LOGO_SIZE_PX}
                  alt={copy.logoAlt}
                  style={styles.logo}
                />
              </Column>
              <Column>
                <Text style={styles.brandName}>{copy.brandName}</Text>
              </Column>
            </Row>
            <Section style={styles.content}>{children}</Section>
          </Section>
          <Section style={styles.footer}>
            <Text style={styles.footerText}>
              {copy.noReply} {copy.contact}{" "}
              <Link href={`mailto:${supportEmail}`} style={styles.footerLink}>
                {supportEmail}
              </Link>
            </Text>
            <Text style={styles.footerText}>
              <Link href={links.terms} style={styles.footerLink}>
                {copy.terms}
              </Link>
              {" · "}
              <Link href={links.privacy} style={styles.footerLink}>
                {copy.privacy}
              </Link>
              {" · "}
              <Link href={links.home} style={styles.footerLink}>
                aido.kr
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
