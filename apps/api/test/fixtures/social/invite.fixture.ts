import { Invite, type InvitePrimitives } from "#api/modules/social/invites/domain/invite.aggregate";
import type { Database } from "#api/platform/database/database.client";
import { invite, user, userProfile } from "#api/platform/database/schema/index";
import { UserFixture } from "#test/fixtures/user.fixture";

// 2028-02-28 12:00 KST. 윤년 2월 말이라 날짜 경계 계산이 하루 밀리면 드러난다
export const INVITE_FIXTURE_NOW = Temporal.Instant.from("2028-02-28T03:00:00Z");

export const INVITE_FIXTURE_ID = "c0000000000000000000inv01";
export const INVITE_FIXTURE_CODE = "K7M2QX";

export interface InviteFixtureUser {
  readonly id: string;
  readonly userTag: string;
  readonly name: string | null;
  readonly profileImage: string | null;
}

export const INVITE_FIXTURE_INVITER: InviteFixtureUser = {
  id: "c0000000000000000000usr01",
  userTag: "INVITER1",
  name: "매튜",
  profileImage: "orange_tabby",
};
export const INVITE_FIXTURE_OTHER_INVITER: InviteFixtureUser = {
  id: "c0000000000000000000usr02",
  userTag: "INVITER2",
  name: null,
  profileImage: null,
};
export const INVITE_FIXTURE_INVITEE: InviteFixtureUser = {
  id: "c0000000000000000000usr03",
  userTag: "INVITEE1",
  name: "친구1",
  profileImage: "black_cat",
};
export const INVITE_FIXTURE_INVITEES: readonly InviteFixtureUser[] = [
  INVITE_FIXTURE_INVITEE,
  { id: "c0000000000000000000usr04", userTag: "INVITEE2", name: "친구2", profileImage: null },
  { id: "c0000000000000000000usr05", userTag: "INVITEE3", name: null, profileImage: null },
  { id: "c0000000000000000000usr06", userTag: "INVITEE4", name: "친구4", profileImage: null },
];

export const INVITE_FIXTURE_INVITER_ID = INVITE_FIXTURE_INVITER.id;
export const INVITE_FIXTURE_OTHER_INVITER_ID = INVITE_FIXTURE_OTHER_INVITER.id;
export const INVITE_FIXTURE_INVITEE_ID = INVITE_FIXTURE_INVITEE.id;

/** 저장소 integration이 FK를 맞추려고 미리 넣는 사용자. InMemory 저장소도 같은 프로필을 쓴다. */
export const INVITE_FIXTURE_USERS: readonly InviteFixtureUser[] = [
  INVITE_FIXTURE_INVITER,
  INVITE_FIXTURE_OTHER_INVITER,
  ...INVITE_FIXTURE_INVITEES,
];

export function inviteFixtureInviteeId(index: number): string {
  const invitee = INVITE_FIXTURE_INVITEES[index];
  if (invitee == null) {
    throw new Error(`invite fixture에 ${index}번째 초대받은 사람이 없습니다`);
  }
  return invitee.id;
}

export function createInviteFixture(overrides: Partial<InvitePrimitives> = {}): Invite {
  return Invite.reconstitute({
    id: INVITE_FIXTURE_ID,
    inviterId: INVITE_FIXTURE_INVITER_ID,
    code: INVITE_FIXTURE_CODE,
    status: "ACTIVE",
    createdAt: INVITE_FIXTURE_NOW,
    revokedAt: null,
    ...overrides,
  });
}

/** 저장소 integration의 FK용 fixture 사용자·프로필과 fixture 초대 행을 넣는다. */
export async function insertInviteFixtureRows(db: Database): Promise<void> {
  await db.insert(user).values(
    INVITE_FIXTURE_USERS.map((fixtureUser) =>
      UserFixture.create({
        id: fixtureUser.id,
        userTag: fixtureUser.userTag,
        email: `${fixtureUser.userTag.toLowerCase()}@example.test`,
      }),
    ),
  );
  const profiles = INVITE_FIXTURE_USERS.flatMap((fixtureUser) =>
    fixtureUser.name == null
      ? []
      : [
          {
            userId: fixtureUser.id,
            name: fixtureUser.name,
            profileImage: fixtureUser.profileImage,
          },
        ],
  );
  await db.insert(userProfile).values(profiles);
  await db.insert(invite).values({
    id: INVITE_FIXTURE_ID,
    inviterId: INVITE_FIXTURE_INVITER_ID,
    // 계약 suite가 쓰는 코드와 겹치지 않게 FK용 초대는 다른 코드다
    code: "ZZZZZZ",
    status: "REVOKED",
    createdAt: INVITE_FIXTURE_NOW,
    revokedAt: INVITE_FIXTURE_NOW,
    updatedAt: INVITE_FIXTURE_NOW,
  });
}
