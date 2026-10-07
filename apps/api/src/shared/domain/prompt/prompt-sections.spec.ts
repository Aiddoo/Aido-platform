/**
 * 공통 프롬프트 섹션 계약 테스트
 *
 * 모든 AI 프롬프트 빌더가 공통 섹션을 실제로 포함하는지를 계약 수준에서 검증합니다.
 * 프롬프트 본문은 각 빌더 자신의 spec에서 검증하고, 여기서는 "보안/출력 규칙 주입 여부"만 봅니다.
 */

import { buildParseMemoPrompt } from "#api/modules/ai-assistance/application/prompts/parsing/parse-memo.prompt";
import { buildParseTodoPrompt } from "#api/modules/ai-assistance/application/prompts/parsing/parse-todo.prompt";
import { buildReportPrompt } from "#api/modules/ai-assistance/application/prompts/reports/report.prompt";
import { buildSuggestionPrompt } from "#api/modules/ai-assistance/application/prompts/suggestions/detect-patterns.prompt";
import type { SuggestionContext } from "#api/modules/ai-assistance/application/types/suggestions/suggestion-context";
import type { AggregatedReportData } from "#api/modules/ai-assistance/domain/types/reports/ai-report.types";

import { PROMPT_OUTPUT_DISCIPLINE, PROMPT_SECURITY_GUARD } from "./prompt-sections.js";

describe("PROMPT_SECTIONS 계약", () => {
  const now = new Date("2026-04-18T12:00:00.000Z");

  it("parse-todo system 프롬프트는 보안 지침과 출력 규칙을 포함해야 한다", () => {
    const { system } = buildParseTodoPrompt("내일 3시 회의", "Asia/Seoul", now);
    expect(system).toContain(PROMPT_SECURITY_GUARD);
    expect(system).toContain(PROMPT_OUTPUT_DISCIPLINE);
  });

  it("parse-memo system 프롬프트는 보안 지침과 출력 규칙을 포함해야 한다", () => {
    const { system } = buildParseMemoPrompt("우유 사기, 청소하기", "Asia/Seoul", now);
    expect(system).toContain(PROMPT_SECURITY_GUARD);
    expect(system).toContain(PROMPT_OUTPUT_DISCIPLINE);
  });

  it("detect-patterns system 프롬프트는 보안 지침과 출력 규칙을 포함해야 한다", () => {
    const ctx: SuggestionContext = {
      todos: [],
      dayCompletionRates: "",
      timeCompletionRates: "",
      categoryRates: "",
      streak: "",
      missingRoutines: [],
      weather: null,
      currentDate: "2026-04-18",
      weeklyReportInsight: null,
      suggestionHistory: [],
    };
    const { system } = buildSuggestionPrompt(ctx, 2);
    expect(system).toContain(PROMPT_SECURITY_GUARD);
    expect(system).toContain(PROMPT_OUTPUT_DISCIPLINE);
  });

  it("report 프롬프트는 출력 규칙을 포함해야 한다", () => {
    const data: AggregatedReportData = {
      hasActivity: true,
      completionRate: 85,
      prevCompletionRate: 70,
      totalTodos: 20,
      completedTodos: 17,
      streakDays: 5,
      categoryBreakdown: [{ name: "업무", color: "#000000", total: 10, completed: 8, rate: 80 }],
      dayPatterns: [{ day: "MON", total: 3, completed: 3, rate: 100 }],
      timePatterns: [],
    };

    const { system } = buildReportPrompt(data, "4월 2주차", "WEEKLY", {
      prevTips: null,
    });
    expect(system).toContain(PROMPT_OUTPUT_DISCIPLINE);
  });
});
