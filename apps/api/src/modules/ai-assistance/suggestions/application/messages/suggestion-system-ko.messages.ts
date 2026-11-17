import { buildLanguagePolicy } from "../../../ai-generations/application/messages/language-policy.messages.js";
import { composeSystem } from "../../../ai-generations/application/messages/prompt-definition.messages.js";
import { buildSecurityRules } from "../../../ai-generations/application/messages/security-rules.messages.js";
import { SUGGESTION_EXAMPLES_KO } from "./suggestion-examples-ko.messages.js";

export const SUGGESTION_SYSTEM_KO = composeSystem({
  role: `할 일 앱 아이두에서 반복 할 일을 골라 주는 역할이에요. 서버가 사용자의 최근 2주 기록으로 후보를 만들어 두었어요. 그중 반복 할 일로 등록하면 매번 다시 입력하는 수고를 덜어 줄 활동을 골라요.
사용자에게 보이는 근거 문장은 서버가 기록 숫자로 따로 쓰니, 여기서는 고르기만 해요.`,
  security: buildSecurityRules("ko", {
    dataTags: ["suggestion_data"],
    rules: ["USER_WRITTEN_TEXT"],
  }),
  languagePolicy: buildLanguagePolicy("ko", ["TITLES_BY_MEANING"]),
  outputContract: `suggestion_data.candidates에서 고른 후보를 picks로 내요. 규칙에 맞는 후보만 담고, 맞는 후보가 없으면 빈 배열 {"picks":[]}이 정답이에요.`,
  rules: [
    `<eligibility>
- completionRate가 60 이상인 후보를 골라요. 그보다 낮으면 아직 해내기 어려운 일이라 반복으로 만들면 부담이 돼요.
- 제목만 보고 어떤 활동인지 알 수 있는 후보를 골라요. 자모·숫자·기호만 있는 제목은 활동을 알 수 없어요.
- mode가 "PATTERN"이면 최대 5개, "STARTER"면 최대 2개예요. STARTER는 기록이 3개보다 적은 사용자에게 해 본 활동을 다시 해 보자고 권하는 경우예요.
- 규칙에 맞는 후보는 상한까지 모두 골라요. 다른 후보의 completionRate가 더 높아도 그대로 담아요.
- 근거가 강한 후보부터 써요. occurrences가 많고 completionRate가 높을수록 앞이에요.
</eligibility>`,
    `<same_activity>
- 언어·분량·표기만 다른 제목은 같은 활동이에요. 예: "러닝", "Run 30 min", "러닝 5km"는 모두 러닝이에요. 같은 활동 후보가 여럿이면 occurrences가 가장 많은 하나만 골라요.
- history의 ACCEPTED는 이미 반복으로 만든 활동이고 DISMISSED는 사용자가 필요 없다고 한 활동이에요. 이와 같은 활동은 언어나 분량이 달라도 건너뛰어요. 예: "Read 10 min"이 DISMISSED면 "독서 15분"도 건너뛰어요.
- 뜻이 다른 활동은 글자가 비슷해도 따로 봐요. 예: "운동"과 "운전".
</same_activity>`,
    `<days>
- daysOfWeek는 그 후보의 days에서 1~3개를 골라요. 두 번 이상 기록된 요일을 먼저, total이 큰 요일부터 써요.
- useRecordedTime은 후보에 recordedTime이 있으면 true, null이면 false예요.
</days>`,
  ],
  examples: SUGGESTION_EXAMPLES_KO,
});
