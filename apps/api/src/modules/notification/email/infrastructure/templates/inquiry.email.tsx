import type { SupportedLocale } from "@aido/api/vocabulary";

import type { InquiryTemplateData } from "../../application/ports/email-template-renderer.port.js";
import {
  AdminEmailBlock,
  AdminEmailChecklist,
  AdminEmailFields,
  AdminEmailHeading,
} from "./admin-email-sections.js";
import { EMAIL_COPY, formatEmailText } from "./email-copy.messages.js";
import { EmailLayout } from "./email-layout.js";

interface InquiryEmailProps extends InquiryTemplateData {
  readonly locale: SupportedLocale;
  readonly supportEmail: string;
}

export default function InquiryEmail({
  locale,
  supportEmail,
  userEmail,
  categoryLabel,
  content,
  submittedAt,
}: InquiryEmailProps) {
  const copy = EMAIL_COPY[locale].inquiry;
  return (
    <EmailLayout
      locale={locale}
      preview={formatEmailText(copy.preview, { categoryLabel, userEmail })}
      supportEmail={supportEmail}
    >
      <AdminEmailHeading eyebrow={copy.eyebrow} title={copy.title} />
      <AdminEmailFields
        fields={[
          { label: copy.userEmail, value: userEmail },
          { label: copy.category, value: categoryLabel },
          { label: copy.submittedAt, value: submittedAt },
        ]}
      />
      <AdminEmailBlock title={copy.content} body={content} />
      <AdminEmailChecklist
        title={copy.checklistTitle}
        steps={[copy.checklist.classify, copy.checklist.reproduce, copy.checklist.reply]}
      />
    </EmailLayout>
  );
}

InquiryEmail.PreviewProps = {
  locale: "ko",
  supportEmail: "support@aido.kr",
  userEmail: "user@example.com",
  category: "BUG_REPORT",
  categoryLabel: "버그 신고",
  content: "할 일을 저장하면 앱이 멈춰요.\n어제부터 계속 그래요.",
  submittedAt: "2026-11-17 14:30 (KST)",
} satisfies InquiryEmailProps;
