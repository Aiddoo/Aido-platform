import { QuotaChargedGenerationAdapter } from "#api/modules/ai-assistance/parsed-drafts/infrastructure/adapters/quota-charged-generation.adapter";
import { FakeAiGenerator } from "#test/doubles/ai-assistance/fake-ai.generator";
import { StubAiDataSharingConsentReader } from "#test/doubles/ai-assistance/stub-ai-data-sharing-consent.reader";
import {
  StubAiUserCategoryReader,
  StubUpcomingTodoReader,
  StubUserLocalePreferenceReader,
} from "#test/doubles/ai-assistance/stub-ai-parsing-readers";
import { RecordingApplicationLogger } from "#test/doubles/platform/recording-application-logger";
import type { AccessUserInput } from "#test/fixtures/access/access-user.fixture";
import { createQuotaLedgerFixture } from "#test/fixtures/access/quota-ledger.fixture";

/** parse-todo·parse-memo UseCase 의존성. 사용량은 실제 원장(메모리 저장소)이 센다. */
export function createAiParsingFixture(
  input: AccessUserInput = {},
  options: Parameters<typeof createQuotaLedgerFixture>[2] = {},
) {
  const ledgerFixture = createQuotaLedgerFixture(input, undefined, options);
  const categoryReader = new StubAiUserCategoryReader();
  categoryReader.categories.set(ledgerFixture.userId, [{ id: 7, name: "업무" }]);
  const logger = new RecordingApplicationLogger();
  return {
    ...ledgerFixture,
    quota: ledgerFixture.ledger,
    chargedGeneration: new QuotaChargedGenerationAdapter({ quota: ledgerFixture.ledger, logger }),
    logger,
    categoryReader,
    upcomingTodoReader: new StubUpcomingTodoReader(),
    generator: new FakeAiGenerator(),
    consentReader: new StubAiDataSharingConsentReader(),
    localePreferenceReader: new StubUserLocalePreferenceReader(),
  };
}
