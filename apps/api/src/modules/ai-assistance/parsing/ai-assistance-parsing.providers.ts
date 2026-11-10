import { type FactoryProvider, Logger, type Provider } from "@nestjs/common";

import { QuotaLedgerPort } from "#api/modules/access/quotas/access-quotas.public";
import { AiDataSharingConsentReaderPort } from "#api/modules/identity/identity-settings.public";
import { loggerFor, provideUseCase } from "#api/platform/di/provide-use-case";
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

const chargedGenerationProvider: FactoryProvider<ChargedGenerationPort> = {
  provide: ChargedGenerationPort,
  inject: [QuotaLedgerPort],
  useFactory: (quota: QuotaLedgerPort) =>
    new QuotaChargedGenerationAdapter({
      quota,
      logger: new Logger(QuotaChargedGenerationAdapter.name),
    }),
};

export const AI_ASSISTANCE_PARSING_PROVIDERS = [
  { provide: UserCategoryReaderPort, useClass: TodoCategoryReaderAdapter },
  { provide: UpcomingTodoReaderPort, useClass: UpcomingTodoReaderAdapter },
  chargedGenerationProvider,
  provideUseCase(GetAiUsageUseCase, { quota: QuotaLedgerPort }),
  provideUseCase(ParseTodoUseCase, {
    generator: AiGeneratorPort,
    consentReader: AiDataSharingConsentReaderPort,
    categoryReader: UserCategoryReaderPort,
    quota: QuotaLedgerPort,
    chargedGeneration: ChargedGenerationPort,
    localePreferenceReader: UserLocalePreferenceReaderPort,
    clock: ClockPort,
    logger: loggerFor(ParseTodoUseCase),
  }),
  provideUseCase(ParseMemoUseCase, {
    generator: AiGeneratorPort,
    consentReader: AiDataSharingConsentReaderPort,
    categoryReader: UserCategoryReaderPort,
    upcomingTodoReader: UpcomingTodoReaderPort,
    quota: QuotaLedgerPort,
    chargedGeneration: ChargedGenerationPort,
    localePreferenceReader: UserLocalePreferenceReaderPort,
    clock: ClockPort,
    logger: loggerFor(ParseMemoUseCase),
  }),
  AiDataSharingConsentGuard,
] satisfies Provider[];
