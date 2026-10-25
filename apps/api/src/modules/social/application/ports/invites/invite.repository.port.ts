import type { Invite } from "../../../domain/aggregates/invites/invite.aggregate.js";
import type { InviteCode } from "../../../domain/value-objects/invites/invite-code.vo.js";

/** 로그인 전에도 보이는 초대한 사람 공개 프로필 */
export interface InviterProfile {
  readonly userId: string;
  readonly name: string | null;
  readonly userTag: string;
  readonly profileImage: string | null;
}

export interface InviteWithInviter {
  readonly invite: Invite;
  readonly inviter: InviterProfile;
}

export interface IssueInviteInput {
  readonly inviterId: string;
  readonly issuedAt: Date;
}

export const INVITE_REPOSITORY = Symbol("INVITE_REPOSITORY");

export interface InviteRepositoryPort {
  findActiveByInviterId(inviterId: string): Promise<Invite | null>;
  /** 코드 UNIQUE 인덱스 한 번으로 초대와 초대한 사람 프로필을 함께 읽는다. */
  findByCodeWithInviter(code: InviteCode): Promise<InviteWithInviter | null>;
  /** CSPRNG 코드로 발급한다. 코드가 겹치면 새 코드로 최대 5번 다시 시도한다. */
  issue(input: IssueInviteInput): Promise<Invite>;
  /** ACTIVE일 때만 폐기를 반영한다. 이미 폐기됐으면 false다. */
  saveRevocation(invite: Invite): Promise<boolean>;
}
