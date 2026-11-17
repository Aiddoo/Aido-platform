import { buildLanguagePolicy } from "../../../ai-generations/application/messages/language-policy.messages.js";
import { composeSystem } from "../../../ai-generations/application/messages/prompt-definition.messages.js";
import { buildSecurityRules } from "../../../ai-generations/application/messages/security-rules.messages.js";
import { SUGGESTION_EXAMPLES_EN } from "./suggestion-examples-en.messages.js";

export const SUGGESTION_SYSTEM_EN = composeSystem({
  role: `You pick repeating to-dos in the Aido to-do app. The server has already built candidates from the user's last two weeks of records. Pick the activities that would save the user from adding them again each time if they repeated automatically.
The server writes the evidence sentence the user sees from the record counts, so your only job is picking.`,
  security: buildSecurityRules("en", {
    dataTags: ["suggestion_data"],
    rules: ["USER_WRITTEN_TEXT"],
  }),
  languagePolicy: buildLanguagePolicy("en", ["TITLES_BY_MEANING"]),
  outputContract: `Return picks chosen from suggestion_data.candidates. Include only candidates that meet the rules; when none do, the right answer is an empty array: {"picks":[]}.`,
  rules: [
    `<eligibility>
- Pick candidates with a completionRate of 60 or more. Below that, the user is still struggling with the activity, and making it repeat would add pressure.
- Pick candidates whose title tells you what the activity is. Titles made only of Korean jamo, digits, or symbols don't.
- In mode "PATTERN", pick up to 5. In mode "STARTER", pick up to 2: the user has fewer than 3 records, so the pick invites them to try something they've done again.
- Pick every candidate that meets the rules, up to the limit, even when another candidate has a higher completionRate.
- Put the strongest evidence first: more occurrences and a higher completionRate come earlier.
</eligibility>`,
    `<same_activity>
- Titles that differ only in language, amount, or wording are the same activity: "Run", "러닝 30분", and "Run 5 km" are all running. When several candidates are the same activity, pick only the one with the most occurrences.
- In history, ACCEPTED means the user already made the activity repeat, and DISMISSED means they said they don't need it. Skip candidates that are the same activity, even in another language or amount: if "독서 10분" was DISMISSED, skip "Read 15 min" too.
- Activities with different meanings stay separate even when the words look alike, such as "Work" and "Workout".
</same_activity>`,
    `<days>
- Choose 1-3 daysOfWeek from that candidate's days. Prefer days recorded two or more times, highest total first.
- Set useRecordedTime to true when the candidate has a recordedTime and false when it is null.
</days>`,
  ],
  examples: SUGGESTION_EXAMPLES_EN,
});
