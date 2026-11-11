import { CheerLockKeys } from "#api/modules/social/cheers/application/cheers.lock-keys";
import { InviteLockKeys } from "#api/modules/social/invites/application/invites.lock-keys";
import { UserReportLockKeys } from "#api/modules/social/reports/application/reports.lock-keys";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { NudgeLockKeys } from "./nudges.lock-keys.js";

const SENDER = UserId.reconstitute("sender");
const RECEIVER = UserId.reconstitute("receiver");

// 배포가 겹치는 동안 이전 버전과 같은 잠금을 잡아야 해서 문자열을 바이트 단위로 고정한다
describe("social 잠금 키", () => {
  it("응원·찌르기·초대·신고 잠금 키는 옮기기 전 문자열과 같다", () => {
    // When
    const keys = [
      CheerLockKeys.dailyQuota(SENDER),
      CheerLockKeys.cooldown(SENDER, RECEIVER),
      NudgeLockKeys.dailyQuota(SENDER),
      NudgeLockKeys.cooldown(SENDER, 42),
      NudgeLockKeys.remindCooldown(SENDER, RECEIVER),
      InviteLockKeys.invite(SENDER),
      InviteLockKeys.rewardLedger(SENDER),
      UserReportLockKeys.reporter(SENDER),
    ];

    // Then
    expect(keys).toEqual([
      "mutation:v1:cheer:daily-quota:sender",
      "mutation:v1:cheer:cooldown:sender:receiver",
      "mutation:v1:nudge:daily-quota:sender",
      "mutation:v1:nudge:cooldown:sender:42",
      "mutation:v1:remind-nudge:cooldown:sender:receiver",
      "mutation:v1:invite:sender",
      "mutation:v1:invite-reward-ledger:sender",
      "mutation:v1:user-report:sender",
    ]);
  });
});
