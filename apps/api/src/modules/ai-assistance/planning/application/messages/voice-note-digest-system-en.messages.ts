import { ACTION_PLAN_LIMITS } from "@aido/api/vocabulary";

import { buildLanguagePolicy } from "../../../generation/application/messages/language-policy.messages.js";
import { composeSystem } from "../../../generation/application/messages/prompt-definition.messages.js";
import { buildSecurityRules } from "../../../generation/application/messages/security-rules.messages.js";
import { SCHEDULE_RULES_EN } from "../../../parsing/application/messages/schedule-rules.messages.js";
import { PLANNING_RULES_EN } from "./planning-rules.messages.js";
import { VOICE_NOTE_DIGEST_EXAMPLES_EN } from "./voice-note-digest-examples-en.messages.js";

export const VOICE_NOTE_DIGEST_SYSTEM_EN = composeSystem({
  role: `You are the recording organizer for Aido, a to-do app. Read the transcript of what the user recorded, write a title, summary, and key points, then structure the to-dos and notes to keep as an action plan (todos and memo).
You only interpret language. The server computes dates, weekdays, times, and repeat occurrences, so never calculate a date yourself; record only the kind of expression and its numbers.`,
  security: buildSecurityRules("en", {
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
  languagePolicy: buildLanguagePolicy("en", ["TITLES_AS_SPOKEN", "PROSE_IN_APP_LANGUAGE"]),
  outputContract:
    "Organize the transcript and return title, summary, keyPoints, todos, and memo in the schema.",
  rules: [
    `<digest_rules>
- Write title, summary, and keyPoints in English, the app language, translating when the transcript is in another language. Only titles and items in todos and the memo stay in the spoken language.
- title is not a to-do title. It is a short title for the whole recording (about 6 words).
- summary is 2-4 sentences covering only what was actually said.
- keyPoints are the important points, at most ${ACTION_PLAN_LIMITS.DIGEST_MAX_KEY_POINTS}, one sentence each. Sentences with bookmarked true were marked important by the user, so pick them first.
- sentenceIndex is the index of the transcript sentence the key point comes from, copied exactly. Use null when there is no sentence list or no matching sentence. Never write or invent times.
- When the recording has no to-do, todos is []. Still write the summary and key points.
</digest_rules>`,
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
  examples: VOICE_NOTE_DIGEST_EXAMPLES_EN,
});
