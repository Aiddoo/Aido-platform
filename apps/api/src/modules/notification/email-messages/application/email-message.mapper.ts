import { createHash } from "node:crypto";

import { match } from "ts-pattern";

import { EmailMessageId } from "../domain/email-message-id.vo.js";
import { EmailMessage, type EmailTag } from "../domain/email-message.aggregate.js";
import type { EmailTemplate, RenderedEmail } from "./ports/email-template-renderer.port.js";

interface EmailEnvelope {
  readonly tags: readonly EmailTag[];
  readonly id: EmailMessageId;
}

function envelopeOf(to: string, template: EmailTemplate): EmailEnvelope {
  return match(template)
    .with({ kind: "inquiry" }, ({ kind, data }) => ({
      tags: [
        { name: "type", value: kind },
        { name: "category", value: data.category },
      ],
      // 응답을 못 받은 재전송이 운영자에게 두 번 가지 않게 같은 내용은 공급자가 한 번만 받는다.
      id: EmailMessageId.reconstitute(
        `inquiry:${createHash("sha256")
          .update(JSON.stringify([to, data.userEmail, data.category, data.content]))
          .digest("hex")}`,
      ),
    }))
    .with({ kind: "user-report" }, ({ kind, data }) => ({
      tags: [
        { name: "type", value: kind },
        { name: "reason", value: data.reason },
      ],
      // 같은 신고를 다시 보내도 운영자에게 한 번만 가도록 신고 ID를 멱등 키로 쓴다.
      id: EmailMessageId.reconstitute(`user-report:${data.reportId}`),
    }))
    .with(
      { kind: "verification" },
      { kind: "password-reset" },
      { kind: "password-setup" },
      ({ kind }) => ({
        tags: [{ name: "type", value: kind }],
        // 코드 메일은 보낼 때마다 새 발송 건이다
        id: EmailMessageId.generate(),
      }),
    )
    .exhaustive();
}

export function toEmailMessage(
  to: string,
  template: EmailTemplate,
  body: RenderedEmail,
): EmailMessage {
  const { tags, id } = envelopeOf(to, template);
  return EmailMessage.create({
    id,
    kind: template.kind,
    to,
    subject: body.subject,
    html: body.html,
    text: body.text,
    tags,
  });
}
