import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { InviterProgressReadModel } from "../read-models/inviter-progress.read-model.js";

// 내 초대 화면이 쓰는 초대한 사람의 인원·보상 진행. invites slice가 코드와 합쳐 응답을 만든다
export abstract class InviterProgressReaderPort {
  abstract readProgress(
    inviterId: UserId,
    now: Temporal.Instant,
  ): Promise<InviterProgressReadModel>;
}
