import { type FactoryProvider, Logger, type Provider } from "@nestjs/common";

import { QUOTA_LEDGER, type QuotaLedgerPort } from "#api/modules/access/access-quota.public";
import { AiDataSharingConsentReaderPort } from "#api/modules/identity/identity-settings.public";
import { ClockPort } from "#api/shared/application/ports/clock.port";

import { AiGeneratorPort } from "../generation/application/ports/ai-generator.port.js";
import { UserLocalePreferenceReaderPort } from "../generation/application/ports/user-locale-preference.reader.port.js";
import { ChargedGenerationPort } from "./application/ports/charged-generation.port.js";
import { UpcomingTodoReaderPort } from "./application/ports/upcoming-todo.reader.port.js";
import { UserCategoryReaderPort } from "./application/ports/user-category.reader.port.js";
import { GetAiUsageUseCase } from "./application/use-cases/get-ai-usage.use-case.js";
import { ParseMemoUseCase } from "./application/use-cases/parse-memo.use-case.js";
import { ParseTodoUseCase } from "./application/use-cases/parse-todo.use-case.js";
import { QuotaChargedGenerationAdapter } from "./infrastructure/adapters/quota-charged-generation.adapter.js";
import { TodoCategoryReaderAdapter } from "./infrastructure/adapters/todo-category-reader.adapter.js";
import { UpcomingTodoReaderAdapter } from "./infrastructure/adapters/upcoming-todo-reader.adapter.js";
import { AiDataSharingConsentGuard } from "./presentation/http/guards/ai-data-sharing-consent.guard.js";
import { AiUsageGuard } from "./presentation/http/guards/ai-usage.guard.js";

// access 사용량 원장은 아직 Symbol 토큰이라 provideUseCase 대신 inject 목록으로 조립한다
const chargedGenerationProvider: FactoryProvider<ChargedGenerationPort> = {
  provide: ChargedGenerationPort,
  inject: [QUOTA_LEDGER],
  useFactory: (quota: QuotaLedgerPort) =>
    new QuotaChargedGenerationAdapter({
      quota,
      logger: new Logger(QuotaChargedGenerationAdapter.name),
    }),
};

const getAiUsageProvider: FactoryProvider<GetAiUsageUseCase> = {
  provide: GetAiUsageUseCase,
  inject: [QUOTA_LEDGER],
  useFactory: (quota: QuotaLedgerPort) => new GetAiUsageUseCase({ quota }),
};

const parseTodoProvider: FactoryProvider<ParseTodoUseCase> = {
  provide: ParseTodoUseCase,
  inject: [
    AiGeneratorPort,
    AiDataSharingConsentReaderPort,
    UserCategoryReaderPort,
    QUOTA_LEDGER,
    ChargedGenerationPort,
    UserLocalePreferenceReaderPort,
    ClockPort,
  ],
  useFactory: (
    generator: AiGeneratorPort,
    consentReader: AiDataSharingConsentReaderPort,
    categoryReader: UserCategoryReaderPort,
    quota: QuotaLedgerPort,
    chargedGeneration: ChargedGenerationPort,
    localePreferenceReader: UserLocalePreferenceReaderPort,
    clock: ClockPort,
  ) =>
    new ParseTodoUseCase({
      generator,
      consentReader,
      categoryReader,
      quota,
      chargedGeneration,
      localePreferenceReader,
      clock,
      logger: new Logger(ParseTodoUseCase.name),
    }),
};

const parseMemoProvider: FactoryProvider<ParseMemoUseCase> = {
  provide: ParseMemoUseCase,
  inject: [
    AiGeneratorPort,
    AiDataSharingConsentReaderPort,
    UserCategoryReaderPort,
    UpcomingTodoReaderPort,
    QUOTA_LEDGER,
    ChargedGenerationPort,
    UserLocalePreferenceReaderPort,
    ClockPort,
  ],
  useFactory: (
    generator: AiGeneratorPort,
    consentReader: AiDataSharingConsentReaderPort,
    categoryReader: UserCategoryReaderPort,
    upcomingTodoReader: UpcomingTodoReaderPort,
    quota: QuotaLedgerPort,
    chargedGeneration: ChargedGenerationPort,
    localePreferenceReader: UserLocalePreferenceReaderPort,
    clock: ClockPort,
  ) =>
    new ParseMemoUseCase({
      generator,
      consentReader,
      categoryReader,
      upcomingTodoReader,
      quota,
      chargedGeneration,
      localePreferenceReader,
      clock,
      logger: new Logger(ParseMemoUseCase.name),
    }),
};

export const AI_ASSISTANCE_PARSING_PROVIDERS = [
  { provide: UserCategoryReaderPort, useClass: TodoCategoryReaderAdapter },
  { provide: UpcomingTodoReaderPort, useClass: UpcomingTodoReaderAdapter },
  chargedGenerationProvider,
  getAiUsageProvider,
  parseTodoProvider,
  parseMemoProvider,
  AiDataSharingConsentGuard,
  AiUsageGuard,
] satisfies Provider[];
