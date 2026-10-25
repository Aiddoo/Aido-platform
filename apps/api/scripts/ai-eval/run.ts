/**
 * parse-todo v2 live eval. 실제 Gemini를 호출하므로 수동·야간에만 실행한다(CI 기본 제외).
 *   GOOGLE_GENERATIVE_AI_API_KEY=… pnpm --filter @aido/server ai:eval [추가 jsonl 경로…]
 * 선택 env:
 *   AI_MODEL_PARSE_TODO  모델 ID (기본 gemini-3.1-flash-lite)
 *   AI_EVAL_THINKING     minimal | low | medium (기본 low)
 *   AI_EVAL_ONLY         쉼표로 구분한 case id만 실행
 *   AI_EVAL_REPORT       case별 결과 JSON을 쓸 경로(원문·키는 담지 않는다)
 *   AI_EVAL_DELAY_MS     호출 사이 대기(기본 500, 분당 호출 상한 보호)
 * 키가 없으면 호출 없이 끝낸다. 결과는 docs/server/ai.md의 검증 기록에 남긴다.
 */
import "../../src/shared/domain/date/dayjs.setup.js";
import { readFileSync, writeFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

import { ConfigService } from "@nestjs/config";

import {
  AI_THINKING_LEVELS,
  AiProviderError,
  type AiThinking,
} from "../../src/modules/ai-assistance/application/ports/parsing/ai-provider.port.js";
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
/** 실패 분류: 어느 필드 묶음이 틀렸는지 */
const FIELD_GROUPS = {
  date: ["startDate", "endDate"],
  time: ["scheduledTime", "isAllDay"],
  repeat: ["isRecurring", "recurrence"],
} as const;
const FIELD_GROUP_NAMES = [
  "date",
  "time",
  "repeat",
] as const satisfies readonly (keyof typeof FIELD_GROUPS)[];

type FailureCategory = keyof typeof FIELD_GROUPS | "title" | "intent" | `error:${string}`;

interface CaseResult {
  readonly id: string;
  readonly pass: boolean;
  readonly categories: readonly FailureCategory[];
  readonly latencyMs: number | null;
  readonly usage: { input: number; output: number; reasoning: number } | null;
  /** 틀린 필드의 기대값·실제값과 모델 draft. 골든 입력 외의 원문은 담지 않는다. */
  readonly diff?: Readonly<Record<string, { expected: unknown; actual: unknown }>>;
  readonly draft?: unknown;
}

function loadExtraCases(paths: readonly string[]): ParseTodoGoldenCase[] {
  return paths.flatMap((path) =>
    readFileSync(path, "utf8")
      .split("\n")
      .filter((line) => line.trim() !== "")
      .map((line) => parseTodoGoldenCaseSchema.parse(JSON.parse(line))),
  );
}

function readThinking(value: string | undefined): AiThinking {
  const level = AI_THINKING_LEVELS.find((candidate) => candidate === value);
  return level ?? "low";
}

const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);

async function main(): Promise<number> {
  const config = new ConfigService(process.env);
  const provider = new GeminiAiAdapter(config);
  if (!provider.isAvailable()) {
    console.log("GOOGLE_GENERATIVE_AI_API_KEY가 없어 live eval을 건너뜁니다.");
    return 0;
  }
  const thinking = readThinking(process.env.AI_EVAL_THINKING);
  const only = new Set(
    (process.env.AI_EVAL_ONLY ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter((id) => id !== ""),
  );
  const delayMs = Number(process.env.AI_EVAL_DELAY_MS ?? 500);
  const cases = [
    ...loadParseTodoGoldenCases("ko"),
    ...loadParseTodoGoldenCases("en"),
    ...loadExtraCases(process.argv.slice(2)),
  ].filter((golden) => only.size === 0 || only.has(golden.id));
  const definition = parseTodoPrompts.v2;
  const results: CaseResult[] = [];
  let model = "";

  for (const [index, golden] of cases.entries()) {
    if (index > 0 && delayMs > 0) await sleep(delayMs);
    const now = new Date(golden.now);
    const { system, prompt } = definition[golden.locale].build({
      text: golden.input,
      timezone: golden.timezone,
      now,
      categories: [],
    });
    try {
      const generated = await provider.generateStructured({
        task: "parse-todo",
        promptVersion: definition[golden.locale].promptVersion,
        system,
        prompt,
        schema: todoDraftSchema,
        policy: resolveGenerationPolicy("parse-todo", { thinking }),
      });
      model = generated.model;
      const { todo } = normalizeTodoDraft(generated.output, {
        now,
        timezone: golden.timezone,
        locale: golden.locale,
        ownedCategoryIds: new Set(),
        fallbackTitle: golden.input,
      });
      const categories: FailureCategory[] = [];
      const diff: Record<string, { expected: unknown; actual: unknown }> = {};
      for (const group of FIELD_GROUP_NAMES) {
        const wrong = FIELD_GROUPS[group].filter(
          (field) => !same(todo[field], golden.expected[field]),
        );
        for (const field of wrong) {
          diff[field] = { expected: golden.expected[field], actual: todo[field] };
        }
        if (wrong.length > 0) categories.push(group);
      }
      if (!(todo.title === golden.expected.title || todo.title.includes(golden.expected.title))) {
        categories.push("title");
        diff.title = { expected: golden.expected.title, actual: todo.title };
      }
      if (generated.output.intent !== golden.draft.intent) {
        categories.push("intent");
        diff.intent = { expected: golden.draft.intent, actual: generated.output.intent };
      }
      results.push({
        id: golden.id,
        pass: categories.length === 0,
        categories,
        latencyMs: generated.latencyMs,
        usage: generated.usage,
        ...(categories.length > 0 && { diff, draft: generated.output }),
      });
    } catch (error) {
      const kind =
        error instanceof AiProviderError
          ? `${error.kind}${error.statusCode === undefined ? "" : `/${error.statusCode}`}`
          : error instanceof Error
            ? error.name
            : "unknown";
      results.push({
        id: golden.id,
        pass: false,
        categories: [`error:${kind}`],
        latencyMs: null,
        usage: null,
      });
    }
    const last = results.at(-1);
    if (last !== undefined) {
      console.log(
        `${last.pass ? "PASS" : "FAIL"} ${last.id} ${last.latencyMs ?? "-"}ms ` +
          `in=${last.usage?.input ?? "-"} out=${last.usage?.output ?? "-"} ` +
          `think=${last.usage?.reasoning ?? "-"} ${last.categories.join(",")}`,
      );
    }
  }

  const rate = (hits: number, total: number) => (total === 0 ? 1 : hits / total);
  const dateFields = new Set<FailureCategory>(["date", "time", "repeat"]);
  const isError = (result: CaseResult) => result.categories.some((c) => c.startsWith("error:"));
  const noActionIds = new Set(
    cases.filter((golden) => golden.draft.intent === "NO_ACTION").map((golden) => golden.id),
  );
  const noActionResults = results.filter((result) => noActionIds.has(result.id));
  const latencies = results.flatMap((result) =>
    result.latencyMs === null ? [] : [result.latencyMs],
  );
  latencies.sort((a, b) => a - b);
  const sum = (pick: (usage: NonNullable<CaseResult["usage"]>) => number) =>
    results.reduce((total, result) => total + (result.usage === null ? 0 : pick(result.usage)), 0);

  const summary = {
    model,
    thinking,
    cases: cases.length,
    pass: rate(results.filter((result) => result.pass).length, cases.length),
    date: rate(
      results.filter((r) => !isError(r) && !r.categories.some((c) => dateFields.has(c))).length,
      cases.length,
    ),
    title: rate(
      results.filter((r) => !isError(r) && !r.categories.includes("title")).length,
      cases.length,
    ),
    noAction: rate(
      noActionResults.filter((r) => !isError(r) && !r.categories.includes("intent")).length,
      noActionResults.length,
    ),
    latencyMs: {
      p50: latencies[Math.floor((latencies.length - 1) / 2)] ?? null,
      max: latencies.at(-1) ?? null,
    },
    tokens: {
      input: sum((usage) => usage.input),
      output: sum((usage) => usage.output),
      reasoning: sum((usage) => usage.reasoning),
    },
    failures: results.filter((result) => !result.pass).map((result) => result.id),
  };
  console.log(JSON.stringify(summary, null, 2));
  const reportPath = process.env.AI_EVAL_REPORT;
  if (reportPath !== undefined && reportPath !== "") {
    writeFileSync(reportPath, JSON.stringify({ summary, results }, null, 2));
  }
  return summary.date >= THRESHOLDS.date &&
    summary.title >= THRESHOLDS.title &&
    summary.noAction >= THRESHOLDS.noAction
    ? 0
    : 1;
}

process.exitCode = await main();
