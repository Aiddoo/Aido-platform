import type { CSSProperties } from "react";
import { Column, Heading, Row, Section, Text } from "react-email";

import { EMAIL_COLORS } from "./email-brand.constants.js";

interface AdminEmailField {
  readonly label: string;
  readonly value: string;
}

const LABEL_COLUMN_WIDTH_PX = 112;

const styles = {
  eyebrow: {
    margin: "0 0 6px",
    fontSize: "13px",
    lineHeight: "20px",
    fontWeight: 700,
    color: EMAIL_COLORS.brandDeep,
  },
  title: {
    margin: "0 0 20px",
    fontSize: "22px",
    lineHeight: "30px",
    fontWeight: 700,
    color: EMAIL_COLORS.ink,
  },
  fieldRow: { borderBottom: `1px solid ${EMAIL_COLORS.line}` },
  fieldLabel: {
    margin: 0,
    padding: "10px 12px 10px 0",
    fontSize: "14px",
    lineHeight: "22px",
    color: EMAIL_COLORS.muted,
  },
  fieldValue: {
    margin: 0,
    padding: "10px 0",
    fontSize: "14px",
    lineHeight: "22px",
    color: EMAIL_COLORS.ink,
    wordBreak: "break-all",
  },
  block: {
    marginTop: "20px",
    padding: "16px 18px",
    borderRadius: "14px",
    backgroundColor: EMAIL_COLORS.cream,
  },
  checklist: {
    marginTop: "12px",
    padding: "16px 18px",
    borderRadius: "14px",
    backgroundColor: EMAIL_COLORS.brandSoft,
  },
  blockTitle: {
    margin: "0 0 6px",
    fontSize: "13px",
    lineHeight: "20px",
    fontWeight: 700,
    color: EMAIL_COLORS.ink,
  },
  blockBody: {
    margin: 0,
    fontSize: "14px",
    lineHeight: "22px",
    color: EMAIL_COLORS.ink,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
} satisfies Record<string, CSSProperties>;

export function AdminEmailHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Heading as="h1" style={styles.title}>
        {title}
      </Heading>
    </>
  );
}

export function AdminEmailFields({ fields }: { fields: readonly AdminEmailField[] }) {
  return (
    <Section>
      {fields.map(({ label, value }) => (
        <Row key={label} style={styles.fieldRow}>
          <Column width={LABEL_COLUMN_WIDTH_PX} valign="top">
            <Text style={styles.fieldLabel}>{label}</Text>
          </Column>
          <Column valign="top">
            <Text style={styles.fieldValue}>{value}</Text>
          </Column>
        </Row>
      ))}
    </Section>
  );
}

// 텍스트 본문은 줄바꿈을 공백으로 합치므로 사용자가 쓴 줄마다 <br>을 둔다
export function AdminEmailBlock({ title, body }: { title: string; body: string }) {
  const lines = body.split("\n");
  return (
    <Section style={styles.block}>
      <Text style={styles.blockTitle}>{title}</Text>
      <Text style={styles.blockBody}>
        {lines.map((line, index) => (
          <span key={index}>
            {index > 0 && <br />}
            {line}
          </span>
        ))}
      </Text>
    </Section>
  );
}

export function AdminEmailChecklist({ title, steps }: { title: string; steps: readonly string[] }) {
  return (
    <Section style={styles.checklist}>
      <Text style={styles.blockTitle}>{title}</Text>
      {steps.map((step, index) => (
        <Text key={step} style={styles.blockBody}>
          {`${index + 1}) ${step}`}
        </Text>
      ))}
    </Section>
  );
}
