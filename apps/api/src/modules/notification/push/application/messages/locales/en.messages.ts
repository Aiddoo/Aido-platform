import { mapValues } from "es-toolkit";

import type {
  NotificationLocaleGrammar,
  NotificationNameForm,
} from "../notification-copy-catalog.messages.js";
import { formatNotificationCopyText } from "../notification-copy-format.messages.js";

const NAME_POSITIONS = ["clauseSubject", "inSentence"] as const;

const NAME_POSITION = {
  name: "inSentence",
  actor: "clauseSubject",
  subject: "clauseSubject",
  author: "inSentence",
  with: "inSentence",
  partner: "clauseSubject",
  topic: "inSentence",
} as const satisfies Record<NotificationNameForm, (typeof NAME_POSITIONS)[number]>;

export const EN_NOTIFICATION_GRAMMAR: NotificationLocaleGrammar = {
  nameForms(name, names) {
    // 문장 중간에서는 이름을 모를 때의 `A friend` 대신 `your friend`로 읽히게 한다
    const isUnknown = name === names.unknownActor;
    const known = formatNotificationCopyText(names.known, { name }, "en");
    return mapValues(NAME_POSITION, (position) =>
      isUnknown && position === "inSentence" ? names.unknownMention : known,
    );
  },
};
