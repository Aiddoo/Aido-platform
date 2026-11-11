import { QuotaChargedGenerationAdapter } from "#api/modules/ai-assistance/parsing/infrastructure/adapters/quota-charged-generation.adapter";
import { AiActionPlanGeneratorAdapter } from "#api/modules/ai-assistance/planning/infrastructure/adapters/ai-action-plan-generator.adapter";
import { QuotaChargedPlanRunnerAdapter } from "#api/modules/voice/action-plans/infrastructure/adapters/quota-charged-plan-runner.adapter";
import { StubAiDataSharingConsentReader } from "#test/doubles/ai-assistance/stub-ai-data-sharing-consent.reader";
import { DateClock } from "#test/doubles/platform/date-clock";
import { RecordingOperationalAlert } from "#test/doubles/platform/recording-operational-alert";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { createQuotaLedgerFixture } from "#test/fixtures/access/quota-ledger.fixture";
import { FakeAiGenerator } from "#test/mocks/fake-ai.generator";

/** 메모리 원장·FakeAiGenerator 위의 계획 흐름 부품. 원장과 생성기는 실제 구현이다. */
export function createPlanFlowFixture(
  ledgerInput: Parameters<typeof createQuotaLedgerFixture>[0] = {},
) {
  const ledgerFixture = createQuotaLedgerFixture(ledgerInput);
  const aiGenerator = new FakeAiGenerator();
  const logger = new SilentLogger();
  // 원장이 vi.setSystemTime으로 고정한 Date를 따라가므로 같은 시계를 쓴다
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
    generator,
    runner,
    localePreferenceReader,
  };
}
