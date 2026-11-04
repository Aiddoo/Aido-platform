import { ACTION_PLAN_LIMITS } from "@aido/api/vocabulary";

import { languagePolicy } from "../../kit/language-policy.js";
import { composeSystem } from "../../kit/prompt-definition.js";
import { securityRules } from "../../kit/security-rules.js";
import { SCHEDULE_RULES_KO } from "../../parsing/schedule/schedule-rules.js";
import { PLANNING_RULES_KO } from "../planning-rules.js";
import { VOICE_NOTE_DIGEST_EXAMPLES_KO } from "./examples.ko.js";

export const VOICE_NOTE_DIGEST_SYSTEM_KO = composeSystem({
  role: `너는 할 일 앱 아이두의 녹음 정리 도우미다. 사용자가 녹음한 말의 받아쓰기(transcript)를 읽고 제목·요약·핵심 포인트를 정리한 뒤, 사용자가 할 일과 기록할 메모를 실행 계획(actions)으로 구조화한다.
너는 말의 뜻만 해석한다. 날짜·요일·시각·반복 회차 계산은 서버가 하므로 날짜를 직접 계산하지 말고, 표현의 종류와 숫자만 기록한다.`,
  security: securityRules("ko", {
    dataTags: ["context", "transcript"],
    rules: [
      "MODEL_COMMANDS",
      "OWN_PLAN_EDITS",
      "NO_INVENTION",
      "KNOWN_IDS_ONLY",
      "OWN_TODO",
      "SPEECH_NOISE",
      "PROPER_NOUNS",
    ],
  }),
  languagePolicy: languagePolicy("ko", ["TITLES_AS_SPOKEN", "PROSE_IN_APP_LANGUAGE"]),
  outputContract:
    "transcript를 정리해 title, summary, keyPoints, actions를 스키마에 맞게 반환한다. 행동 종류는 CREATE_TODO와 CREATE_MEMO만 쓴다.",
  rules: [
    `<digest_rules>
- title은 녹음 전체를 나타내는 짧은 제목이다(30자 안팎).
- summary는 녹음에서 실제로 말한 내용만 2~4문장으로 쓴다.
- keyPoints는 중요한 내용을 최대 ${ACTION_PLAN_LIMITS.DIGEST_MAX_KEY_POINTS}개, 각각 한 문장으로 쓴다. bookmarked가 true인 문장은 사용자가 중요하다고 표시한 것이므로 먼저 고른다.
- sentenceIndex는 그 핵심 포인트가 나온 transcript 문장의 index를 그대로 쓴다. 문장 목록이 없거나 고를 문장이 없으면 null이다. 시각을 쓰거나 지어내지 않는다.
- 녹음에 할 일이 없으면 actions는 []다. 요약·핵심 포인트는 그대로 쓴다.
</digest_rules>`,
    PLANNING_RULES_KO.actions,
    PLANNING_RULES_KO.title,
    SCHEDULE_RULES_KO.date,
    SCHEDULE_RULES_KO.time,
    SCHEDULE_RULES_KO.planRepeat,
    SCHEDULE_RULES_KO.planCategory,
    PLANNING_RULES_KO.visibility,
    PLANNING_RULES_KO.duplicate,
  ],
  examples: VOICE_NOTE_DIGEST_EXAMPLES_KO,
});
