/**
 * parse-todo v2 live eval. 실제 Gemini를 호출하므로 수동·야간에만 실행한다(CI 기본 제외).
 *   GOOGLE_GENERATIVE_AI_API_KEY=… pnpm --filter @aido/server ai:eval [추가 jsonl 경로…]
 * 키가 없으면 호출 없이 끝낸다. 결과는 docs/server/ai.md의 검증 기록에 남긴다.
 */
import "../../src/shared/domain/date/dayjs.setup.js";
import { readFileSync } from "node:fs";

import { ConfigService } from "@nestjs/config";

import { parseTodoPrompts } from "../../src/modules/ai-assistance/application/prompts/parsing/parse-todo/index.js";
import { todoDraftSchema } from "../../src/modules/ai-assistance/application/prompts/parsing/shared/v2/todo-draft.schema.js";
import { resolveGenerationPolicy } from "../../src/modules/ai-assistance/application/services/parsing/ai-generation-policy.js";
import { normalizeTodoDraft } from "../../src/modules/ai-assistance/application/services/parsing/todo-draft.normalizer.js";
import { GeminiAiAdapter } from "../../src/modules/ai-assistance/infrastructure/adapters/parsing/gemini-ai.adapter.js";
import {
  loadParseTodoGoldenCases,
  type ParseTodoGoldenCase,
  parseTodoGoldenCaseSchema,
} from "../../test/fixtures/ai-golden/golden-cases.js";

const THRESHOLDS = { date: 0.97, title: 0.9, noAction: 1 } as const;
const DATE_FIELDS = [
  "startDate",
  "endDate",
  "scheduledTime",
  "isAllDay",
  "isRecurring",
  "recurrence",
] as const;

function loadExtraCases(paths: readonly string[]): ParseTodoGoldenCase[] {
  return paths.flatMap((path) =>
    readFileSync(path, "utf8")
      .split("\n")
      .filter((line) => line.trim() !== "")
      .map((line) => parseTodoGoldenCaseSchema.parse(JSON.parse(line))),
  );
}

async function main(): Promise<number> {
  const config = new ConfigService(process.env);
  const provider = new GeminiAiAdapter(config);
  if (!provider.isAvailable()) {
    console.log("GOOGLE_GENERATIVE_AI_API_KEY가 없어 live eval을 건너뜁니다.");
    return 0;
  }
  const cases = [
    ...loadParseTodoGoldenCases("ko"),
    ...loadParseTodoGoldenCases("en"),
    ...loadExtraCases(process.argv.slice(2)),
  ];
  const definition = parseTodoPrompts.v2;
  let dateHits = 0;
  let titleHits = 0;
  let noActionTotal = 0;
  let noActionHits = 0;
  const failures: string[] = [];

  for (const golden of cases) {
    const now = new Date(golden.now);
    const { system, prompt } = definition[golden.locale].build({
      text: golden.input,
      timezone: golden.timezone,
      now,
      categories: [],
    });
    try {
      const { output, model } = await provider.generateStructured({
        task: "parse-todo",
        promptVersion: definition[golden.locale].promptVersion,
        system,
        prompt,
        schema: todoDraftSchema,
        policy: resolveGenerationPolicy("parse-todo", { thinking: "low" }),
      });
      const { todo } = normalizeTodoDraft(output, {
        now,
        timezone: golden.timezone,
        locale: golden.locale,
        ownedCategoryIds: new Set(),
        fallbackTitle: golden.input,
      });
      const dateOk = DATE_FIELDS.every(
        (field) => JSON.stringify(todo[field]) === JSON.stringify(golden.expected[field]),
      );
      const titleOk =
        todo.title === golden.expected.title || todo.title.includes(golden.expected.title);
      if (dateOk) dateHits += 1;
      if (titleOk) titleHits += 1;
      if (golden.draft.intent === "NO_ACTION") {
        noActionTotal += 1;
        if (output.intent === "NO_ACTION") noActionHits += 1;
      }
      if (!dateOk || !titleOk) failures.push(`${golden.id} (${model})`);
    } catch (error) {
      failures.push(`${golden.id} (${error instanceof Error ? error.name : "error"})`);
    }
  }

  const rate = (hits: number, total: number) => (total === 0 ? 1 : hits / total);
  const summary = {
    cases: cases.length,
    date: rate(dateHits, cases.length),
    title: rate(titleHits, cases.length),
    noAction: rate(noActionHits, noActionTotal),
    failures,
  };
  console.log(JSON.stringify(summary, null, 2));
  return summary.date >= THRESHOLDS.date &&
    summary.title >= THRESHOLDS.title &&
    summary.noAction >= THRESHOLDS.noAction
    ? 0
    : 1;
}

process.exitCode = await main();
