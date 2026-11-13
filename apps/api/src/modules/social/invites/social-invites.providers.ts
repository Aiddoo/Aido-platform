import type { Provider } from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";

import { InviterProgressReaderPort } from "#api/modules/social/invite-redemptions/social-invite-redemption-queries.public";
import { loggerFor, provideUseCase } from "#api/platform/di/provide-use-case";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";

import { InviteCodeGeneratorPort } from "./application/ports/invite-code-generator.port.js";
import { InviteConfigPort } from "./application/ports/invite-config.port.js";
import { InviteReaderPort } from "./application/ports/invite.reader.port.js";
import { InviteRepositoryPort } from "./application/ports/invite.repository.port.js";
import { GetInviteAvailabilityUseCase } from "./application/use-cases/get-invite-availability.use-case.js";
import { IssueInviteCodeUseCase } from "./application/use-cases/issue-invite-code.use-case.js";
import { IssueMyInviteUseCase } from "./application/use-cases/issue-my-invite.use-case.js";
import { PreviewInviteUseCase } from "./application/use-cases/preview-invite.use-case.js";
import { RotateInviteCodeUseCase } from "./application/use-cases/rotate-invite-code.use-case.js";
import { SummarizeMyInviteUseCase } from "./application/use-cases/summarize-my-invite.use-case.js";
import { RandomInviteCodeGeneratorAdapter } from "./infrastructure/adapters/invite-code-generator.adapter.js";
import { DrizzleInviteReader } from "./infrastructure/persistence/drizzle-invite.reader.js";
import { DrizzleInviteRepository } from "./infrastructure/persistence/drizzle-invite.repository.js";
import { socialInvitesConfig } from "./social-invites.config.js";

export const SOCIAL_INVITES_PROVIDERS = [
  {
    provide: InviteConfigPort,
    inject: [socialInvitesConfig.KEY],
    useFactory: (config: ConfigType<typeof socialInvitesConfig>): InviteConfigPort => ({
      isEnabled: config.enabled,
    }),
  },
  { provide: InviteRepositoryPort, useClass: DrizzleInviteRepository },
  { provide: InviteReaderPort, useClass: DrizzleInviteReader },
  { provide: InviteCodeGeneratorPort, useClass: RandomInviteCodeGeneratorAdapter },
  provideUseCase(GetInviteAvailabilityUseCase, { inviteConfig: InviteConfigPort }),
  provideUseCase(IssueInviteCodeUseCase, {
    inviteRepository: InviteRepositoryPort,
    codeGenerator: InviteCodeGeneratorPort,
  }),
  provideUseCase(SummarizeMyInviteUseCase, { inviterProgressReader: InviterProgressReaderPort }),
  provideUseCase(IssueMyInviteUseCase, {
    unitOfWork: UnitOfWorkPort,
    mutationLock: MutationLockPort,
    inviteRepository: InviteRepositoryPort,
    issueInviteCode: IssueInviteCodeUseCase,
    summarizeMyInvite: SummarizeMyInviteUseCase,
    inviteConfig: InviteConfigPort,
    clock: ClockPort,
    logger: loggerFor(IssueMyInviteUseCase),
  }),
  provideUseCase(RotateInviteCodeUseCase, {
    unitOfWork: UnitOfWorkPort,
    mutationLock: MutationLockPort,
    inviteRepository: InviteRepositoryPort,
    issueInviteCode: IssueInviteCodeUseCase,
    summarizeMyInvite: SummarizeMyInviteUseCase,
    inviteConfig: InviteConfigPort,
    clock: ClockPort,
    logger: loggerFor(RotateInviteCodeUseCase),
  }),
  provideUseCase(PreviewInviteUseCase, {
    inviteReader: InviteReaderPort,
    inviteConfig: InviteConfigPort,
  }),
] satisfies Provider[];
