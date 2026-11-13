import { Module } from "@nestjs/common";

import { provideUseCase } from "#api/platform/di/provide-use-case";

import { InviteRedemptionReaderPort } from "./application/ports/invite-redemption.reader.port.js";
import { InviterProgressReaderPort } from "./application/ports/inviter-progress.reader.port.js";
import { SummarizeInviterProgressUseCase } from "./application/use-cases/summarize-inviter-progress.use-case.js";
import { InviterProgressReaderAdapter } from "./infrastructure/adapters/inviter-progress-reader.adapter.js";
import { DrizzleInviteRedemptionReader } from "./infrastructure/persistence/drizzle-invite-redemption.reader.js";

// 수락·보상 조회만 둔다. 초대 코드 Module이 import해도 수락 Module(초대 코드 Module을 import)과 순환이 없게
// 다른 Module을 import하지 않는다
@Module({
  providers: [
    { provide: InviteRedemptionReaderPort, useClass: DrizzleInviteRedemptionReader },
    provideUseCase(SummarizeInviterProgressUseCase, {
      inviteRedemptionReader: InviteRedemptionReaderPort,
    }),
    { provide: InviterProgressReaderPort, useClass: InviterProgressReaderAdapter },
  ],
  exports: [InviteRedemptionReaderPort, InviterProgressReaderPort],
})
export class SocialInviteRedemptionQueriesModule {}
