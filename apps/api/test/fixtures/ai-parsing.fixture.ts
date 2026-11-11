import { QuotaChargedGenerationAdapter } from "#api/modules/ai-assistance/parsing/infrastructure/adapters/quota-charged-generation.adapter";
import { createSpyApplicationLogger } from "#test/doubles/ai-assistance/spy-application-logger";
import { DateClock } from "#test/doubles/platform/date-clock";
import { FakeAiGenerator } from "#test/mocks/fake-ai.generator";
import { StubAiDataSharingConsent } from "#test/mocks/ports/ai-assistance.stub";
import {
  StubAiUserCategoryReader,
  StubUpcomingTodoReader,
  StubUserLocalePreferenceReader,
} from "#test/mocks/ports/ai-parsing.stub";

import type { AccessUserInput } from "./access/access-user.fixture.js";
import { createQuotaLedgerFixture } from "./access/quota-ledger.fixture.js";

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
    consentReader: new StubAiDataSharingConsent(),
    localePreferenceReader: new StubUserLocalePreferenceReader(),
  };
}
