import { type SupportedLocale } from "@aido/api/vocabulary";
import { match } from "ts-pattern";

import { deterministicIndex } from "#api/shared/domain/services/deterministic-variant";

import type {
  NotificationMessage,
  RetentionNotificationCopySelection,
  RetentionTemplateKey,
} from "./notification-copy-catalog.messages.js";
import { RETENTION_COPY } from "./notification-copy-templates.messages.js";
import { renderNotificationVariant } from "./notification-copy.messages.js";

export type RetentionNotificationInput = RetentionNotificationCopySelection & {
  readonly locale: SupportedLocale;
  readonly selectionContext: {
    readonly recipientId: string;
    readonly occurrenceKey: string;
  };
};

export function createRetentionNotificationMessage(
  input: RetentionNotificationInput,
): NotificationMessage {
  const { locale } = input;
  const templateKey = retentionTemplateKey(input);
  const template = RETENTION_COPY[templateKey];

  const index = deterministicIndex(
    `${templateKey}\u0000${input.selectionContext.recipientId}\u0000${input.selectionContext.occurrenceKey}`,
    template.variantNames.length,
  );

  return {
    ...renderNotificationVariant(template, { index, facts: {}, locale }),
    variantId: `${input.copyKey}.v${index + 1}`,
  };
}

function retentionTemplateKey(selection: RetentionNotificationCopySelection): RetentionTemplateKey {
  return match(selection)
    .returnType<RetentionTemplateKey>()
    .with({ stage: "D0" }, () => "D0:d0_no_todo")
    .with({ stage: "D1", copyKey: "d1_no_todo" }, () => "D1:d1_no_todo")
    .with(
      { stage: "D1", copyKey: "d1_has_todo_no_completion" },
      () => "D1:d1_has_todo_no_completion",
    )
    .with({ stage: "D3" }, () => "D3:d3_restart")
    .with({ stage: "D7", copyKey: "d7_has_progress" }, () => "D7:d7_has_progress")
    .with({ stage: "D7", copyKey: "d7_restart" }, () => "D7:d7_restart")
    .exhaustive();
}
