import type { SupportedLocale } from "@aido/api/vocabulary";
import type { CSSProperties } from "react";
import { Button, Section } from "react-email";

import type { UserReportTemplateData } from "../../application/ports/email-template-renderer.port.js";
import {
  AdminEmailBlock,
  AdminEmailChecklist,
  AdminEmailFields,
  AdminEmailHeading,
} from "./admin-email-sections.js";
import { EMAIL_COLORS } from "./email-brand.constants.js";
import { EMAIL_COPY, formatEmailText } from "./email-copy.messages.js";
import { EmailLayout } from "./email-layout.js";

interface UserReportEmailProps extends UserReportTemplateData {
  readonly locale: SupportedLocale;
  readonly supportEmail: string;
}

const MISSING_TARGET_ID = "-";

const styles = {
  action: { marginTop: "24px", textAlign: "center" },
  button: {
    display: "inline-block",
    padding: "12px 20px",
    borderRadius: "12px",
    backgroundColor: EMAIL_COLORS.brandDeep,
    color: EMAIL_COLORS.paper,
    fontSize: "15px",
    lineHeight: "20px",
    fontWeight: 600,
    textDecoration: "none",
  },
} satisfies Record<string, CSSProperties>;

export default function UserReportEmail(props: UserReportEmailProps) {
  const { locale, supportEmail, detail, resolutionDocsUrl } = props;
  const copy = EMAIL_COPY[locale]["user-report"];
  return (
    <EmailLayout
      locale={locale}
      preview={formatEmailText(copy.preview, {
        reasonLabel: props.reasonLabel,
        targetUserTag: props.targetUserTag,
      })}
      supportEmail={supportEmail}
    >
      <AdminEmailHeading eyebrow={copy.eyebrow} title={copy.title} />
      <AdminEmailFields
        fields={[
          { label: copy.reportId, value: props.reportId },
          { label: copy.reason, value: `${props.reasonLabel} (${props.reason})` },
          { label: copy.targetType, value: `${props.targetTypeLabel} (${props.targetType})` },
          { label: copy.targetId, value: props.targetId ?? MISSING_TARGET_ID },
          { label: copy.targetUser, value: `${props.targetUserTag} · ${props.targetUserId}` },
          { label: copy.reporter, value: `${props.reporterTag} · ${props.reporterId}` },
          { label: copy.submittedAt, value: props.submittedAt },
          { label: copy.resolutionEndpoint, value: props.resolutionEndpoint },
        ]}
      />
      <AdminEmailBlock title={copy.detail} body={detail ?? copy.noDetail} />
      <AdminEmailChecklist
        title={copy.checklistTitle}
        steps={[copy.checklist.review, copy.checklist.act, copy.checklist.resolve]}
      />
      {resolutionDocsUrl != null && (
        <Section style={styles.action}>
          <Button href={resolutionDocsUrl} style={styles.button}>
            {copy.openDocs}
          </Button>
        </Section>
      )}
    </EmailLayout>
  );
}

UserReportEmail.PreviewProps = {
  locale: "ko",
  supportEmail: "support@aido.kr",
  reportId: "clz7x5p8k0123qz0z8z8z8z8z",
  reporterId: "clz7x5p8k0001qz0z8z8z8z8z",
  reporterTag: "MORNING7",
  targetUserId: "clz7x5p8k0005qz0z8z8z8z8z",
  targetUserTag: "NIGHT42",
  targetType: "COMMENT",
  targetTypeLabel: "댓글",
  targetId: "clz7x5p8k0099qz0z8z8z8z8z",
  reason: "HARASSMENT",
  reasonLabel: "괴롭힘·혐오",
  detail: "댓글에 욕설이 있어요.",
  submittedAt: "2026-11-17 18:00 (KST)",
  resolutionEndpoint: "POST /v1/admin/reports/clz7x5p8k0123qz0z8z8z8z8z/resolution",
  resolutionDocsUrl: "https://api.example.com/api/admin/docs#/Admin/resolveUserReport",
} satisfies UserReportEmailProps;
