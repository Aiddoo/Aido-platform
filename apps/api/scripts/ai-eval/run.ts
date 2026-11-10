/**
 * AI 프롬프트 live eval. 실제 AI 업체를 호출하므로 수동으로만 실행한다(CI·hook 제외).
 *   pnpm --filter @aido/server ai:eval --task parse-todo|parse-memo|quick-plan|voice-note-digest \
 *     --provider anthropic|google|openai [추가 jsonl 경로…]
 * 키는 운영 설정과 같은 env(ANTHROPIC_API_KEY·GOOGLE_GENERATIVE_AI_API_KEY·OPENAI_API_KEY)에서 읽는다.
 * 고른 업체의 키가 없으면 호출 없이 안내만 하고 0으로 끝낸다. --provider를 빼면 AI_PROVIDER_ORDER 폴백 체인이다.
 * 선택 env:
 *   AI_MODEL_<PROVIDER>  업체별 모델 ID (기본 claude-haiku-5-5 / gemini-3.1-flash-lite / gpt-6-luna)
 *   AI_EVAL_THINKING     minimal | low | medium (기본: 운영 설정 AI_THINKING_<TASK>)
 *   AI_EVAL_ONLY         쉼표로 구분한 case id만 실행
 *   AI_EVAL_REPORT       case별 결과 JSON을 쓸 경로(키는 담지 않는다)
 *   AI_EVAL_DELAY_MS     호출 사이 대기(기본 500, 분당 호출 상한 보호)
 * 콘솔에는 case id·통과 여부·지연·토큰·비용만 쓰고 입력 원문·전사·키는 쓰지 않는다.
 * 기준: 날짜 0.97, 제목 0.9, 겹침 판정 0.9(계획), NO_ACTION 1(parse-todo). 결과는 apps/api/docs/ai.md에 남긴다.
 */
import "../../src/shared/domain/date/dayjs.setup.js";
import { writeFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { parseArgs } from "node:util";

import { AI_DATA_SHARING_CONSENT, AI_PROVIDER_IDS } from "@aido/api/vocabulary";
import { ConfigService } from "@nestjs/config";
import { omit } from "es-toolkit";
import { match } from "ts-pattern";

import { AiGenerationError } from "#api/modules/ai-assistance/generation/application/ai-generation.errors";
import { generateWithPrompt } from "#api/modules/ai-assistance/generation/application/messages/prompt-definition.messages";
import type {
  AiGenerationMeta,
  AiGeneratorPort,
} from "#api/modules/ai-assistance/generation/application/ports/ai-generator.port";
import {
  type AiProviderAdapter,
  AiProviderCatalog,
} from "#api/modules/ai-assistance/generation/infrastructure/adapters/ai-provider.adapter";
import { AiSdkGeneratorAdapter } from "#api/modules/ai-assistance/generation/infrastructure/adapters/ai-sdk-generator.adapter";
import { AiSpendBudgetAdapter } from "#api/modules/ai-assistance/generation/infrastructure/adapters/ai-spend-budget.adapter";
import { AnthropicProviderAdapter } from "#api/modules/ai-assistance/generation/infrastructure/adapters/anthropic-provider.adapter";
import { GoogleProviderAdapter } from "#api/modules/ai-assistance/generation/infrastructure/adapters/google-provider.adapter";
import { OpenAiProviderAdapter } from "#api/modules/ai-assistance/generation/infrastructure/adapters/openai-provider.adapter";
import { parseMemoPrompt } from "#api/modules/ai-assistance/parsing/application/messages/parse-memo-prompt.messages";
import { parseTodoPrompt } from "#api/modules/ai-assistance/parsing/application/messages/parse-todo-prompt.messages";
import { quickPlanPrompt } from "#api/modules/ai-assistance/planning/application/messages/quick-plan-prompt.messages";
import { voiceNoteDigestPrompt } from "#api/modules/ai-assistance/planning/application/messages/voice-note-digest-prompt.messages";
import type { NormalizedActionPlan } from "#api/modules/ai-assistance/planning/domain/action-plan-draft.constants";

import { AI_THINKING_LEVELS } from "../../src/platform/config/schemas/ai.schema.js";
import { TypedConfigService } from "../../src/platform/config/services/config.service.js";
import { OutboundPolicyRegistry } from "../../src/platform/resilience/outbound-policy.registry.js";
import { SystemClock } from "../../src/platform/time/system-clock.js";
import type { OperationalAlertPort } from "../../src/shared/application/ports/operational-alert.port.js";
import {
  GOLDEN_MEMO_CATEGORY_ID,
  GOLDEN_TASKS,
  GOLDEN_VARIANTS,
  type GoldenTask,
  loadParseMemoGoldenCases,
  loadParseTodoGoldenCases,
  loadQuickPlanGoldenCases,
  loadVoiceNoteDigestGoldenCases,
  type ParseMemoGoldenCase,
  parseMemoGoldenCaseSchema,
  type ParseTodoGoldenCase,
  parseTodoGoldenCaseSchema,
  type PlannedTodoExpectation,
  type QuickPlanGoldenCase,
  quickPlanGoldenCaseSchema,
  readGoldenLines,
  toPlanExpectation,
  type VoiceNoteDigestGoldenCase,
  voiceNoteDigestGoldenCaseSchema,
} from "../../test/fixtures/ai-golden/golden-cases.js";
import { InMemoryUsageMeterAdapter } from "../../test/mocks/in-memory-usage-meter.adapter.js";

const THRESHOLDS = { date: 0.97, title: 0.9, duplicate: 0.9, noAction: 1 } as const;

type Metric = "date" | "title" | "duplicate" | "noAction";

interface CaseScore {
  /** 이 case가 해당 지표의 대상이 아니면 없다 */
  readonly metrics: Partial<Record<Metric, boolean>>;
  readonly bookmarkRecall?: number;
  /** 녹음 정리의 제목·요약·핵심 포인트가 앱 언어인지 */
  readonly isDigestInAppLanguage?: boolean;
  readonly diff?: unknown;
}

interface CaseResult extends CaseScore {
  readonly id: string;
  readonly error: string | null;
  readonly latencyMs: number | null;
  readonly usage: {
    input: number;
    cached: number;
    cacheWrite: number;
    output: number;
    reasoning: number;
  } | null;
  /** 이 case가 쓴 추정 비용(micro-USD, 캐시 단가 반영). 단가를 모르는 모델이면 null */
  readonly costMicroUsd: number | null;
}

interface EvalCase {
  readonly id: string;
  /** 이 case가 대상인 지표. 생성이 실패하면 모두 실패로 센다. */
  readonly metrics: readonly Metric[];
  generate(
    generator: Pick<AiGeneratorPort, "generate">,
  ): Promise<{ readonly score: CaseScore; readonly meta: AiGenerationMeta }>;
}

const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);
/** 관사·소유격 유무("Fix the copy"·"Fix copy")는 같은 답이고 제목 규칙도 짧게 쓰라고 한다. */
const titleKey = (title: string) =>
  title
    .toLowerCase()
    .replace(/\b(a|an|the|my)\b/g, "")
    .replace(/[\s\p{P}]/gu, "");
const titleMatches = (expected: string, actual: string) =>
  titleKey(actual).includes(titleKey(expected)) || titleKey(expected).includes(titleKey(actual));
const options = { agreedConsentVersion: AI_DATA_SHARING_CONSENT.VERSION, userId: null } as const;

function planContext(golden: Pick<QuickPlanGoldenCase, "context">) {
  return {
    ownedCategoryIds: new Set(golden.context.categories.map(({ id }) => id)),
    upcomingTodoIds: new Set(golden.context.upcomingTodos.map(({ id }) => id)),
  };
}

/** 기대 할 일마다 제목이 맞는 실제 할 일을 순서대로 짝짓고 날짜·겹침을 비교한다. */
function scorePlan(
  expected: { todos: readonly PlannedTodoExpectation[]; memo: unknown },
  actual: ReturnType<typeof toPlanExpectation>,
): CaseScore {
  const remaining = [...actual.todos];
  const pairs = expected.todos.map((todo) => {
    const index = remaining.findIndex((candidate) => titleMatches(todo.title, candidate.title));
    const [matched] = index === -1 ? [undefined] : remaining.splice(index, 1);
    return { expected: todo, actual: matched };
  });
  const allMatched = pairs.every((pair) => pair.actual != null) && remaining.length === 0;
  const memoMatches = (expected.memo == null) === (actual.memo == null);
  const dateFields = ["startDate", "endDate", "scheduledTime", "repeat"] as const;
  const datesMatch = pairs.every(
    (pair) =>
      pair.actual != null &&
      dateFields.every((field) => same(pair.expected[field], pair.actual?.[field])),
  );
  const duplicatesMatch = pairs.every(
    (pair) => pair.actual?.duplicateOfTodoId === pair.expected.duplicateOfTodoId,
  );
  const pass = allMatched && memoMatches && datesMatch && duplicatesMatch;
  return {
    metrics: {
      title: allMatched && memoMatches,
      date: allMatched && datesMatch,
      duplicate: allMatched && duplicatesMatch,
    },
    ...(!pass && { diff: { expected, actual } }),
  };
}

function parseTodoCase(golden: ParseTodoGoldenCase): EvalCase {
  return {
    id: golden.id,
    metrics:
      golden.draft.intent === "NO_ACTION" ? ["date", "title", "noAction"] : ["date", "title"],
    async generate(generator) {
      const now = new Date(golden.now);
      const built = parseTodoPrompt.build(
        { text: golden.input, timezone: golden.timezone, now, categories: [] },
        golden.locale,
      );
      const { value, meta } = await generateWithPrompt(
        generator,
        parseTodoPrompt,
        built,
        {
          text: golden.input,
          timezone: golden.timezone,
          now,
          locale: golden.locale,
          ownedCategoryIds: new Set<number>(),
          requestedCategoryId: undefined,
        },
        options,
      );
      // golden은 출시 응답 칸만 기대값으로 갖는다. 새 선택 칸 repeat은 비교하지 않는다.
      const { title, categoryId: _categoryId, repeat: _repeat, ...schedule } = value.parsedTodo;
      const {
        title: expectedTitle,
        categoryId: _expectedCategoryId,
        ...expectedSchedule
      } = golden.expected;
      const date = same(schedule, expectedSchedule);
      const titleOk = titleMatches(expectedTitle, title);
      const noAction = golden.draft.intent === "NO_ACTION";
      const intentOk = value.intent === golden.draft.intent;
      return {
        meta,
        score: {
          metrics: { date, title: titleOk, ...(noAction && { noAction: intentOk }) },
          ...(!(date && titleOk && intentOk) && {
            diff: { expected: golden.expected, actual: value.parsedTodo, intent: value.intent },
          }),
        },
      };
    },
  };
}

/** 메모는 할 일을 입력 순서대로 만들므로 같은 순서로 제목과 일정을 비교한다. */
function parseMemoCase(golden: ParseMemoGoldenCase): EvalCase {
  return {
    id: golden.id,
    metrics: ["date", "title"],
    async generate(generator) {
      const now = new Date(golden.now);
      const built = parseMemoPrompt.build(
        {
          content: golden.input,
          timezone: golden.timezone,
          now,
          categories: [],
          upcomingTodos: [],
        },
        golden.locale,
      );
      const { value, meta } = await generateWithPrompt(
        generator,
        parseMemoPrompt,
        built,
        {
          content: golden.input,
          timezone: golden.timezone,
          now,
          locale: golden.locale,
          ownedCategoryIds: new Set<number>(),
          defaultCategoryId: GOLDEN_MEMO_CATEGORY_ID,
          upcomingTodos: [],
        },
        options,
      );
      const actual = value.parsedMemo.todos;
      const expected = golden.expected.todos;
      const sameCount = actual.length === expected.length;
      const toSchedule = (todo: (typeof actual)[number]) =>
        omit(todo, ["title", "repeat", "items", "categoryId", "duplicateOfTodoId"]);
      const date =
        sameCount &&
        expected.every(
          (todo, index) =>
            actual[index] != null && same(toSchedule(todo), toSchedule(actual[index])),
        );
      const title =
        sameCount &&
        expected.every(
          (todo, index) => actual[index] != null && titleMatches(todo.title, actual[index].title),
        );
      return {
        meta,
        score: {
          metrics: { date, title },
          ...(!(date && title) && {
            diff: { expected: golden.expected, actual: value.parsedMemo },
          }),
        },
      };
    },
  };
}

const PLAN_METRICS = ["date", "title", "duplicate"] as const satisfies readonly Metric[];

function quickPlanCase(golden: QuickPlanGoldenCase): EvalCase {
  return {
    id: golden.id,
    metrics: PLAN_METRICS,
    async generate(generator) {
      const now = new Date(golden.now);
      const built = quickPlanPrompt.build(
        { text: golden.input, now, timezone: golden.timezone, ...golden.context },
        golden.locale,
      );
      const { value, meta } = await generateWithPrompt(
        generator,
        quickPlanPrompt,
        built,
        planContext(golden),
        options,
      );
      const clock = { now, timeZone: golden.timezone };
      return { meta, score: scorePlan(golden.expected, toPlanExpectation(value, clock)) };
    },
  };
}

/** 지원 언어가 ko·en뿐이라 한글 유무로 가른다. 고유명사는 앱 언어가 달라도 원문 표기일 수 있어 지표로만 본다. */
function isWrittenInLocale(texts: readonly string[], locale: VoiceNoteDigestGoldenCase["locale"]) {
  const hasHangul = (text: string) => /\p{Script=Hangul}/u.test(text);
  return texts.every((text) => hasHangul(text) === (locale === "ko"));
}

function voiceNoteDigestCase(golden: VoiceNoteDigestGoldenCase): EvalCase {
  return {
    id: golden.id,
    metrics: PLAN_METRICS,
    async generate(generator) {
      const now = new Date(golden.now);
      const built = voiceNoteDigestPrompt.build(
        {
          transcript: golden.sentences.map(({ text }) => text).join("\n"),
          sentences: golden.sentences,
          now,
          timezone: golden.timezone,
          ...golden.context,
        },
        golden.locale,
      );
      const { value, meta } = await generateWithPrompt(
        generator,
        voiceNoteDigestPrompt,
        built,
        { ...planContext(golden), sentenceCount: golden.sentences.length },
        options,
      );
      const plan: NormalizedActionPlan = value.plan;
      const clock = { now, timeZone: golden.timezone };
      const bookmarked = golden.sentences.flatMap(({ isBookmarked }, index) =>
        isBookmarked ? [index] : [],
      );
      const picked = new Set(value.keyPoints.map(({ sentenceIndex }) => sentenceIndex));
      const score = scorePlan(golden.expected, toPlanExpectation(plan, clock));
      const digestTexts = [value.title, value.summary, ...value.keyPoints.map(({ text }) => text)];
      const isDigestInAppLanguage = isWrittenInLocale(digestTexts, golden.locale);
      return {
        meta,
        score: {
          ...score,
          ...(!isDigestInAppLanguage && score.diff == null && { diff: { digestTexts } }),
          bookmarkRecall:
            bookmarked.length === 0
              ? 1
              : bookmarked.filter((index) => picked.has(index)).length / bookmarked.length,
          isDigestInAppLanguage,
        },
      };
    },
  };
}

function loadCases(task: GoldenTask, extraPaths: readonly string[]): EvalCase[] {
  return match(task)
    .with("parse-todo", () =>
      [
        ...GOLDEN_VARIANTS.flatMap((variant) => loadParseTodoGoldenCases(variant)),
        ...extraPaths.flatMap((path) => readGoldenLines(parseTodoGoldenCaseSchema, path)),
      ].map(parseTodoCase),
    )
    .with("parse-memo", () =>
      [
        ...GOLDEN_VARIANTS.flatMap((variant) => loadParseMemoGoldenCases(variant)),
        ...extraPaths.flatMap((path) => readGoldenLines(parseMemoGoldenCaseSchema, path)),
      ].map(parseMemoCase),
    )
    .with("quick-plan", () =>
      [
        ...GOLDEN_VARIANTS.flatMap((variant) => loadQuickPlanGoldenCases(variant)),
        ...extraPaths.flatMap((path) => readGoldenLines(quickPlanGoldenCaseSchema, path)),
      ].map(quickPlanCase),
    )
    .with("voice-note-digest", () =>
      [
        ...GOLDEN_VARIANTS.flatMap((variant) => loadVoiceNoteDigestGoldenCases(variant)),
        ...extraPaths.flatMap((path) => readGoldenLines(voiceNoteDigestGoldenCaseSchema, path)),
      ].map(voiceNoteDigestCase),
    )
    .exhaustive();
}

const THINKING_ENV = {
  "parse-todo": "AI_THINKING_PARSE_TODO",
  "parse-memo": "AI_THINKING_PARSE_MEMO",
  "quick-plan": "AI_THINKING_QUICK_PLAN",
  "voice-note-digest": "AI_THINKING_VOICE_NOTE_DIGEST",
} as const satisfies Record<GoldenTask, string>;

/** --provider·AI_EVAL_THINKING을 운영 설정 env에 덮어 실제 생성 체인을 만든다. */
function createGenerator(task: GoldenTask, provider: string | undefined) {
  const thinking = AI_THINKING_LEVELS.find((level) => level === process.env.AI_EVAL_THINKING);
  const config = new TypedConfigService(
    new ConfigService({
      ...process.env,
      ...(provider != null && { AI_PROVIDER_ORDER: provider }),
      ...(thinking != null && { [THINKING_ENV[task]]: thinking }),
    }),
  );
  const adapters: AiProviderAdapter[] = [
    new AnthropicProviderAdapter(config),
    new GoogleProviderAdapter(config),
    new OpenAiProviderAdapter(config),
  ];
  const alert: OperationalAlertPort = {
    raise: (raised) => console.warn(`alert ${raised.key} ${JSON.stringify(raised.tags ?? {})}`),
  };
  const available = config.ai.providerOrder.some(
    (id) => adapters.find((adapter) => adapter.id === id)?.getModel(task) != null,
  );
  return {
    generator: new AiSdkGeneratorAdapter(
      config,
      new AiProviderCatalog(adapters),
      new OutboundPolicyRegistry(alert),
      new AiSpendBudgetAdapter(config, new InMemoryUsageMeterAdapter(), alert, new SystemClock()),
      alert,
    ),
    available,
    thinking: config.ai.tasks[task].thinking,
  };
}

function describeError(error: unknown): string {
  if (error instanceof AiGenerationError) {
    const status = error.upstream?.statusCode;
    return status == null ? error.kind : `${error.kind}/${status}`;
  }
  return error instanceof Error ? error.name : "unknown";
}

function readCli() {
  const { values, positionals } = parseArgs({
    options: { task: { type: "string" }, provider: { type: "string" } },
    allowPositionals: true,
  });
  const task = GOLDEN_TASKS.find((candidate) => candidate === values.task);
  const provider = AI_PROVIDER_IDS.find((candidate) => candidate === values.provider);
  if (task == null || (values.provider != null && provider == null)) {
    return null;
  }
  return { task, provider, extraPaths: positionals };
}

async function main(): Promise<number> {
  const cli = readCli();
  if (cli == null) {
    console.log(
      `사용법: pnpm ai:eval --task ${GOLDEN_TASKS.join("|")} [--provider ${AI_PROVIDER_IDS.join("|")}] [추가 jsonl…]`,
    );
    return 2;
  }
  const { generator, available, thinking } = createGenerator(cli.task, cli.provider);
  if (!available) {
    console.log(
      `${cli.provider ?? "AI_PROVIDER_ORDER"} 업체의 API 키가 없어 live eval을 건너뜁니다(호출 0회).`,
    );
    return 0;
  }
  const only = new Set(
    (process.env.AI_EVAL_ONLY ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter((id) => id !== ""),
  );
  const delayMs = Number(process.env.AI_EVAL_DELAY_MS ?? 500);
  const cases = loadCases(cli.task, cli.extraPaths).filter(
    (golden) => only.size === 0 || only.has(golden.id),
  );
  const results: CaseResult[] = [];
  let model = "";

  for (const [index, golden] of cases.entries()) {
    if (index > 0 && delayMs > 0) {
      await sleep(delayMs);
    }
    try {
      const { score, meta } = await golden.generate(generator);
      model = meta.model;
      results.push({
        id: golden.id,
        error: null,
        ...score,
        latencyMs: meta.latencyMs,
        usage: {
          input: meta.inputTokens,
          cached: meta.cachedInputTokens,
          cacheWrite: meta.cacheWriteInputTokens,
          output: meta.outputTokens,
          reasoning: meta.reasoningTokens,
        },
        costMicroUsd: meta.estimatedCostMicroUsd,
      });
    } catch (error) {
      results.push({
        id: golden.id,
        error: describeError(error),
        metrics: Object.fromEntries(golden.metrics.map((metric) => [metric, false])),
        latencyMs: null,
        usage: null,
        costMicroUsd: null,
      });
    }
    const last = results.at(-1);
    if (last !== undefined) {
      const failed = Object.entries(last.metrics).flatMap(([name, ok]) => (ok ? [] : [name]));
      console.log(
        `${last.error == null && failed.length === 0 ? "PASS" : "FAIL"} ${last.id} ${last.latencyMs ?? "-"}ms ` +
          `in=${last.usage?.input ?? "-"} cached=${last.usage?.cached ?? "-"} ` +
          `cacheWrite=${last.usage?.cacheWrite ?? "-"} out=${last.usage?.output ?? "-"} ` +
          `think=${last.usage?.reasoning ?? "-"} ${last.error ?? failed.join(",")}`,
      );
    }
  }

  /** 지표 대상 case 중 통과 비율. 대상 case가 없으면 null이다. */
  const rate = (metric: Metric) => {
    const targets = results.filter((result) => result.metrics[metric] !== undefined);
    return targets.length === 0
      ? null
      : targets.filter((result) => result.metrics[metric] === true).length / targets.length;
  };
  const latencies = results
    .flatMap((result) => (result.latencyMs === null ? [] : [result.latencyMs]))
    .sort((left, right) => left - right);
  const sum = (pick: (usage: NonNullable<CaseResult["usage"]>) => number) =>
    results.reduce((total, result) => total + (result.usage === null ? 0 : pick(result.usage)), 0);
  const recalls = results.flatMap((result) =>
    result.bookmarkRecall == null ? [] : [result.bookmarkRecall],
  );

  const languageChecks = results.flatMap((result) =>
    result.isDigestInAppLanguage == null ? [] : [result],
  );

  const summary = {
    task: cli.task,
    model,
    thinking,
    cases: cases.length,
    errors: results.filter((result) => result.error != null).length,
    date: rate("date"),
    title: rate("title"),
    duplicate: rate("duplicate"),
    noAction: rate("noAction"),
    ...(recalls.length > 0 && {
      bookmarkRecall: recalls.reduce((total, value) => total + value, 0) / recalls.length,
    }),
    ...(languageChecks.length > 0 && {
      digestInAppLanguage:
        languageChecks.filter((result) => result.isDigestInAppLanguage === true).length /
        languageChecks.length,
      digestLanguageFailures: languageChecks
        .filter((result) => result.isDigestInAppLanguage === false)
        .map((result) => result.id),
    }),
    latencyMs: {
      p50: latencies[Math.floor((latencies.length - 1) / 2)] ?? null,
      p95: latencies[Math.ceil(latencies.length * 0.95) - 1] ?? null,
      max: latencies.at(-1) ?? null,
    },
    tokens: {
      input: sum((usage) => usage.input),
      cached: sum((usage) => usage.cached),
      cacheWrite: sum((usage) => usage.cacheWrite),
      output: sum((usage) => usage.output),
      reasoning: sum((usage) => usage.reasoning),
    },
    // 캐시 읽기·쓰기 단가를 반영한 값이다. tokens.cached·cacheWrite로 적중을 함께 본다.
    estimatedCostMicroUsd: results.reduce((total, result) => total + (result.costMicroUsd ?? 0), 0),
    failures: results
      .filter((result) => result.error != null || Object.values(result.metrics).includes(false))
      .map((result) => result.id),
  };
  console.log(JSON.stringify(summary, null, 2));
  const reportPath = process.env.AI_EVAL_REPORT;
  if (reportPath !== undefined && reportPath !== "") {
    writeFileSync(reportPath, JSON.stringify({ summary, results }, null, 2));
  }
  const metrics = ["date", "title", "duplicate", "noAction"] as const satisfies readonly Metric[];
  const passed = metrics.every((metric) => (summary[metric] ?? 1) >= THRESHOLDS[metric]);
  return passed ? 0 : 1;
}

process.exitCode = await main();
