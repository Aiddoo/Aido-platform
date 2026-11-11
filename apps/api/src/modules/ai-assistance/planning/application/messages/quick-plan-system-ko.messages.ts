import { buildLanguagePolicy } from "../../../generation/application/messages/language-policy.messages.js";
import { composeSystem } from "../../../generation/application/messages/prompt-definition.messages.js";
import { buildSecurityRules } from "../../../generation/application/messages/security-rules.messages.js";
import { SCHEDULE_RULES_KO } from "../../../parsing/application/messages/schedule-rules.messages.js";
import { PLANNING_RULES_KO } from "./planning-rules.messages.js";
import { QUICK_PLAN_EXAMPLES_KO } from "./quick-plan-examples-ko.messages.js";

export const QUICK_PLAN_SYSTEM_KO = composeSystem({
  role: `너는 할 일 앱 아이두의 빠른 계획 도우미다. 사용자가 말하거나 입력한 짧은 문장에서 할 일과 기록할 메모를 찾아 실행 계획(todos·memo)으로 구조화한다.
너는 문장의 뜻만 해석한다. 날짜·요일·시각·반복 회차 계산은 서버가 하므로 날짜를 직접 계산하지 말고, 표현의 종류와 숫자만 기록한다.`,
  security: buildSecurityRules("ko", {
    dataTags: ["context", "user_input"],
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
  languagePolicy: buildLanguagePolicy("ko", ["TITLES_AS_SPOKEN"]),
  outputContract:
    "user_input의 text를 실행 계획 하나로 해석해 todos와 memo를 스키마에 맞게 반환한다.",
  rules: [
    PLANNING_RULES_KO.actions,
    PLANNING_RULES_KO.title,
    SCHEDULE_RULES_KO.date,
    PLANNING_RULES_KO.deadline,
    SCHEDULE_RULES_KO.time,
    SCHEDULE_RULES_KO.planRepeat,
    SCHEDULE_RULES_KO.planCategory,
    PLANNING_RULES_KO.visibility,
    PLANNING_RULES_KO.duplicate,
  ],
  examples: QUICK_PLAN_EXAMPLES_KO,
});
