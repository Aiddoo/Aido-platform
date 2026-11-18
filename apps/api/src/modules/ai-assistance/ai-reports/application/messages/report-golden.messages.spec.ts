import { FakeAiGenerator } from "#test/doubles/ai-assistance/fake-ai.generator";
import {
  GOLDEN_VARIANTS,
  loadReportGoldenCases,
  type ReportGoldenCase,
} from "#test/fixtures/ai-golden/golden-cases";

import { generateWithPrompt } from "../../../ai-generations/application/messages/prompt-definition.messages.js";
import type { ReportDraft } from "../../../shared/domain/ai-task-outputs.constants.js";
import { numbersIn } from "../../domain/grounded-numbers.domain-service.js";
import { ReportDraftRejectedError } from "../ai-reports.errors.js";
import { buildReportContext } from "./report-context.messages.js";
import { buildReportEvidence, reportPrompt } from "./report-prompt.messages.js";

const cases = GOLDEN_VARIANTS.flatMap((variant) => loadReportGoldenCases(variant));

function generate(golden: ReportGoldenCase, draft: ReportDraft) {
  const context = buildReportContext(golden.input, golden.locale);
  const built = reportPrompt.build(context, golden.locale);
  const generation = generateWithPrompt(new FakeAiGenerator().setRawResponse(draft), reportPrompt, {
    built,
    context: { context, locale: golden.locale },
    agreedConsentVersion: null,
    userId: null,
  });
  return { context, prompt: built.prompt, generation };
}

describe("리포트 golden — 이상적인 모델 출력은 서버 정리를 그대로 통과하고 다른 항목 숫자는 걸러진다", () => {
  it("모든 golden 줄이 schema를 통과하고 카테고리·요일·활동 적음·하락·첫 리포트·이전 팁·주입·월간을 담는다", () => {
    // When
    const inputs = cases.map(({ input }) => input);
    // Then
    expect(new Set(cases.map(({ id }) => id)).size).toBe(cases.length);
    expect(inputs.some(({ reportData }) => reportData.categoryBreakdown.length >= 2)).toBe(true);
    expect(inputs.some(({ reportData }) => reportData.dayPatterns.length === 7)).toBe(true);
    expect(inputs.some(({ reportData }) => reportData.totalTodos <= 3)).toBe(true);
    expect(
      inputs.some(
        ({ reportData }) =>
          reportData.prevCompletionRate != null &&
          reportData.completionRate < reportData.prevCompletionRate,
      ),
    ).toBe(true);
    expect(inputs.some(({ previousTips }) => previousTips != null)).toBe(true);
    expect(
      inputs.some(({ type, period }) => type === "MONTHLY" && period.end.endsWith("-31")),
    ).toBe(true);
    expect(cases.some(({ expected }) => expected.forbiddenPhrases.length > 0)).toBe(true);
  });

  it.each(cases)("$id 이상적인 출력은 grounding·길이 정리를 그대로 통과한다", async (golden) => {
    // When
    const { context, prompt, generation } = generate(golden, golden.draft);
    const { value } = await generation;
    // Then
    expect(value).toEqual({ aiSummary: golden.draft.insight, aiTips: golden.draft.tips });
    const keys = context.focus.items.map(({ key }) => key);
    expect(golden.draft.insightKey == null || keys.includes(golden.draft.insightKey)).toBe(true);
    expect(golden.draft.tips.some((tip) => golden.input.previousTips?.includes(tip))).toBe(false);
    for (const phrase of golden.expected.forbiddenPhrases) {
      expect(`${golden.draft.insight} ${golden.draft.tips.join(" ")}`).not.toContain(phrase);
    }
    expect(prompt).not.toMatch(/<\/report_data>\s*\S/);
  });

  it.each(
    cases.filter(({ draft, input, locale }) => {
      const { overallNumbers } = buildReportEvidence(buildReportContext(input, locale));
      return numbersIn(draft.insight).some((value) => !overallNumbers.includes(value));
    }),
  )(
    "$id insight의 항목 숫자를 전체 흐름(null)으로 내면 문장을 빼고 템플릿으로 넘긴다",
    async (golden) => {
      // When
      const { generation } = generate(golden, { ...golden.draft, insightKey: null });
      // Then
      await expect(generation).rejects.toThrow(ReportDraftRejectedError);
    },
  );
});
