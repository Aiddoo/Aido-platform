import { josa } from "es-hangul";
import { mapValues } from "es-toolkit";

import type {
  NotificationLocaleGrammar,
  NotificationNameForm,
} from "../notification-copy-catalog.messages.js";
import { formatNotificationCopyText } from "../notification-copy-format.messages.js";

type JosaParticle = Parameters<typeof josa>[1];

/** 영문·emoji 닉네임에서도 알림 생성을 실패시키지 않는 조사 부착 경계. */
function attachJosa(value: string, particle: JosaParticle): string {
  try {
    return josa(value, particle);
  } catch {
    return value;
  }
}

const NAME_PARTICLE = {
  name: null,
  actor: null,
  subject: "이/가",
  author: "이/가",
  with: "와/과",
  partner: "와/과",
  topic: "은/는",
} as const satisfies Record<NotificationNameForm, JosaParticle | null>;

export const KO_NOTIFICATION_GRAMMAR: NotificationLocaleGrammar = {
  nameForms(name, names) {
    // 앱 화면처럼 이름에 `님`을 붙이고, 이름을 모를 때의 `친구`에는 붙이지 않는다
    const honorific =
      name === names.unknownActor ? name : formatNotificationCopyText(names.known, { name }, "ko");
    return mapValues(NAME_PARTICLE, (particle) =>
      particle == null ? honorific : attachJosa(honorific, particle),
    );
  },
};
