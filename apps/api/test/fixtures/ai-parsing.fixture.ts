import { mock } from "vitest-mock-extended";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { FakeAiGenerator } from "#test/mocks/fake-ai.generator";
import { StubAiDataSharingConsent } from "#test/mocks/ports/ai-assistance.stub";
import {
  StubAiUserCategoryReader,
  StubUserLocalePreferenceReader,
} from "#test/mocks/ports/ai-parsing.stub";
import type { InMemoryQuotaUser } from "#test/mocks/ports/quota-ledger.stub";

import { createQuotaLedgerFixture } from "./quota-ledger.fixture.js";

/** parse-todo·parse-memo UseCase 의존성. 사용량은 실제 원장(메모리 저장소)이 센다. */
export function createAiParsingFixture(input: Partial<InMemoryQuotaUser> = {}) {
  const ledgerFixture = createQuotaLedgerFixture(input);
  const categoryReader = new StubAiUserCategoryReader();
  categoryReader.categories.set(ledgerFixture.userId, [{ id: 7, name: "업무" }]);
  return {
    ...ledgerFixture,
    quota: ledgerFixture.ledger,
    logger: mock<ApplicationLogger>(),
    categoryReader,
    generator: new FakeAiGenerator(),
    consentReader: new StubAiDataSharingConsent(),
    localePreferenceReader: new StubUserLocalePreferenceReader(),
  };
}
