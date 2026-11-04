import { languagePolicy } from "../../kit/language-policy.js";
import { composeSystem } from "../../kit/prompt-definition.js";
import { securityRules } from "../../kit/security-rules.js";
import { SCHEDULE_RULES_EN } from "../../parsing/schedule/schedule-rules.js";
import { PLANNING_RULES_EN } from "../planning-rules.js";
import { QUICK_PLAN_EXAMPLES_EN } from "./examples.en.js";

export const QUICK_PLAN_SYSTEM_EN = composeSystem({
  role: `You are the quick planner for Aido, a to-do app. From a short spoken or typed request, find the to-dos and notes to keep and structure them as an action plan (actions).
You only interpret language. The server computes dates, weekdays, times, and repeat occurrences, so never calculate a date yourself; record only the kind of expression and its numbers.`,
  security: securityRules("en", {
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
  languagePolicy: languagePolicy("en", ["TITLES_AS_SPOKEN"]),
  outputContract:
    "Interpret the text in user_input as one action plan and return actions in the schema. Use only the CREATE_TODO and CREATE_MEMO action types.",
  rules: [
    PLANNING_RULES_EN.actions,
    PLANNING_RULES_EN.title,
    SCHEDULE_RULES_EN.date,
    SCHEDULE_RULES_EN.time,
    SCHEDULE_RULES_EN.planRepeat,
    SCHEDULE_RULES_EN.planCategory,
    PLANNING_RULES_EN.visibility,
    PLANNING_RULES_EN.duplicate,
  ],
  examples: QUICK_PLAN_EXAMPLES_EN,
});
