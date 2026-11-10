import { QuotaChargedGenerationAdapter } from "#api/modules/ai-assistance/parsing/infrastructure/adapters/quota-charged-generation.adapter";
import { AiActionPlanGeneratorAdapter } from "#api/modules/ai-assistance/planning/infrastructure/adapters/ai-action-plan-generator.adapter";
import type { PlanResultReplay } from "#api/modules/voice/action-plans/application/ports/plan-result-replay.port";
import type {
  PlanningContext,
  PlanningContextReaderPort,
} from "#api/modules/voice/action-plans/application/ports/planning-context.reader.port";
import { QuotaChargedPlanRunnerAdapter } from "#api/modules/voice/action-plans/infrastructure/adapters/quota-charged-plan-runner.adapter";
import { createSpyApplicationLogger } from "#test/doubles/ai-assistance/spy-application-logger";
import { StubAiDataSharingConsentReader } from "#test/doubles/ai-assistance/stub-ai-data-sharing-consent.reader";
import { DateClock } from "#test/doubles/platform/date-clock";
import { RecordingOperationalAlert } from "#test/doubles/platform/recording-operational-alert";
import { FakeAiGenerator } from "#test/mocks/fake-ai.generator";

import { createQuotaLedgerFixture } from "./access/quota-ledger.fixture.js";

/** 계획 프롬프트 모델 출력의 할 일 하나. 빠진 칸은 schema가 null로 채운다. */
export function todoActionDraft(overrides: Record<string, unknown> = {}) {
  return {
    title: "회의록 보내기",
    categoryId: null,
    date: { kind: "CALENDAR_DATE", year: 2027, month: 1, day: 4 },
    endDate: null,
    time: null,
    repeat: { pattern: "NONE" },
    visibility: null,
    items: [],
    duplicateOfTodoId: null,
    ...overrides,
  };
}

export function memoActionDraft(overrides: Record<string, unknown> = {}) {
  return { title: "아이디어", content: "온보딩 문구 다듬기", ...overrides };
}

export function digestDraft(overrides: Record<string, unknown> = {}) {
  return {
    title: "주간 회의",
    summary: "다음 주 일정을 정했습니다.",
    keyPoints: [{ text: "회의록을 보내기로 했습니다.", sentenceIndex: 1 }],
    todos: [todoActionDraft()],
    memo: null,
    ...overrides,
  };
}

export const EMPTY_PLANNING_CONTEXT: PlanningContext = {
  categories: [{ id: 1, name: "업무" }],
  upcomingTodos: [],
};

export class InMemoryPlanResultReplay<T> implements PlanResultReplay<T> {
  readonly results = new Map<string, T>();

  async save(userId: string, idempotencyKey: string, result: T): Promise<void> {
    this.results.set(`${userId}:${idempotencyKey}`, result);
  }

  async find(userId: string, idempotencyKey: string): Promise<T | null> {
    return this.results.get(`${userId}:${idempotencyKey}`) ?? null;
  }
}

export function stubPlanningContextReader(
  context: PlanningContext = EMPTY_PLANNING_CONTEXT,
): Pick<PlanningContextReaderPort, "read"> {
  return { read: async () => context };
}

/** 메모리 원장·FakeAiGenerator 위의 계획 흐름 부품. 원장과 생성기는 실제 구현이다. */
export function createPlanFlowFixture(
  ledgerInput: Parameters<typeof createQuotaLedgerFixture>[0] = {},
) {
  const ledgerFixture = createQuotaLedgerFixture(ledgerInput);
  const aiGenerator = new FakeAiGenerator();
  const logger = createSpyApplicationLogger();
  const clock = new DateClock();
  const alert = new RecordingOperationalAlert();
  const consentReader = new StubAiDataSharingConsentReader();
  consentReader.decision = "AGREED";
  const quota = {
    reserve: ledgerFixture.ledger.reserve.bind(ledgerFixture.ledger),
    commit: ledgerFixture.ledger.commit.bind(ledgerFixture.ledger),
    refund: ledgerFixture.ledger.refund.bind(ledgerFixture.ledger),
    reopen: ledgerFixture.ledger.reopen.bind(ledgerFixture.ledger),
    read: ledgerFixture.ledger.read.bind(ledgerFixture.ledger),
  };
  const generator = new AiActionPlanGeneratorAdapter({
    generator: aiGenerator,
    consentReader,
    clock,
    logger,
  });
  const chargedGeneration = new QuotaChargedGenerationAdapter({ quota, logger });
  const runner = new QuotaChargedPlanRunnerAdapter({ quota, chargedGeneration });
  const localePreferenceReader = {
    read: async () => ({ timezone: "Asia/Seoul", locale: "ko" as const }),
  };
  return {
    ...ledgerFixture,
    aiGenerator,
    logger,
    clock,
    alert,
    quota,
    chargedGeneration,
    generator,
    runner,
    localePreferenceReader,
  };
}
