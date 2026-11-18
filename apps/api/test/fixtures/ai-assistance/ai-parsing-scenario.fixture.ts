import { QuotaChargedGenerationAdapter } from "#api/modules/ai-assistance/parsed-drafts/infrastructure/adapters/quota-charged-generation.adapter";
import { FakeAiGenerator } from "#test/doubles/ai-assistance/fake-ai.generator";
import { createSpyApplicationLogger } from "#test/doubles/ai-assistance/spy-application-logger";
import { StubAiDataSharingConsentReader } from "#test/doubles/ai-assistance/stub-ai-data-sharing-consent.reader";
import {
  StubAiUserCategoryReader,
  StubUpcomingTodoReader,
  StubUserLocalePreferenceReader,
} from "#test/doubles/ai-assistance/stub-ai-parsing-readers";
import { DateClock } from "#test/doubles/platform/date-clock";
import type { AccessUserInput } from "#test/fixtures/access/access-user.fixture";
import { createQuotaLedgerFixture } from "#test/fixtures/access/quota-ledger.fixture";

/** parse-todo·parse-memo UseCase 의존성. 사용량은 실제 원장(메모리 저장소)이 센다. */
export function createAiParsingFixture(input: AccessUserInput = {}) {
  const ledgerFixture = createQuotaLedgerFixture(input);
  const categoryReader = new StubAiUserCategoryReader();
  categoryReader.categories.set(ledgerFixture.userId, [{ id: 7, name: "업무" }]);
  const logger = createSpyApplicationLogger();
  return {
    ...ledgerFixture,
    quota: ledgerFixture.ledger,
    chargedGeneration: new QuotaChargedGenerationAdapter({ quota: ledgerFixture.ledger, logger }),
    clock: new DateClock(),
    logger,
    categoryReader,
    upcomingTodoReader: new StubUpcomingTodoReader(),
    generator: new FakeAiGenerator(),
    consentReader: new StubAiDataSharingConsentReader(),
    localePreferenceReader: new StubUserLocalePreferenceReader(),
  };
}
