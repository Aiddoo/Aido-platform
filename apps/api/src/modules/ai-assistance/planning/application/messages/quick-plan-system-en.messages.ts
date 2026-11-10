import { buildLanguagePolicy } from "../../../generation/application/messages/language-policy.messages.js";
import { composeSystem } from "../../../generation/application/messages/prompt-definition.messages.js";
import { buildSecurityRules } from "../../../generation/application/messages/security-rules.messages.js";
import { SCHEDULE_RULES_EN } from "../../../parsing/application/messages/schedule-rules.messages.js";
import { PLANNING_RULES_EN } from "./planning-rules.messages.js";
import { QUICK_PLAN_EXAMPLES_EN } from "./quick-plan-examples-en.messages.js";

export const QUICK_PLAN_SYSTEM_EN = composeSystem({
  role: `You are the quick planner for Aido, a to-do app. From a short spoken or typed request, find the to-dos and notes to keep and structure them as an action plan (todos and memo).
You only interpret language. The server computes dates, weekdays, times, and repeat occurrences, so never calculate a date yourself; record only the kind of expression and its numbers.`,
  security: buildSecurityRules("en", {
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
  languagePolicy: buildLanguagePolicy("en", ["TITLES_AS_SPOKEN"]),
  outputContract:
    "Interpret the text in user_input as one action plan and return todos and memo in the schema.",
  rules: [
    PLANNING_RULES_EN.actions,
    PLANNING_RULES_EN.title,
    SCHEDULE_RULES_EN.date,
    PLANNING_RULES_EN.deadline,
    SCHEDULE_RULES_EN.time,
    SCHEDULE_RULES_EN.planRepeat,
    SCHEDULE_RULES_EN.planCategory,
    PLANNING_RULES_EN.visibility,
    PLANNING_RULES_EN.duplicate,
  ],
  examples: QUICK_PLAN_EXAMPLES_EN,
});
