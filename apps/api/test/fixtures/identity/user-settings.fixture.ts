import { UserFixture } from "#test/fixtures/user.fixture";
import type { User } from "#test/types/database-rows";

// 재확인 대상 페이지 순서가 DB 정렬과 같도록 id는 길이가 같고 이 순서대로 정렬된다
export const USER_SETTINGS_FIXTURE_USER_ID = "clz7x5p8k0011qz0z8z8z8z8z";
export const USER_SETTINGS_FIXTURE_OTHER_USER_ID = "clz7x5p8k0012qz0z8z8z8z8z";
export const USER_SETTINGS_FIXTURE_INACTIVE_USER_ID = "clz7x5p8k0013qz0z8z8z8z8z";
export const USER_SETTINGS_FIXTURE_DELETED_USER_ID = "clz7x5p8k0014qz0z8z8z8z8z";

export const USER_SETTINGS_FIXTURE_NOW = Temporal.Instant.from("2026-11-10T00:00:00.000Z");

/** 활성 사용자가 아니어서 광고성 동의 재확인 대상에서 빠지는 사용자 */
export const USER_SETTINGS_FIXTURE_INACTIVE_USER_IDS = [
  USER_SETTINGS_FIXTURE_INACTIVE_USER_ID,
  USER_SETTINGS_FIXTURE_DELETED_USER_ID,
] as const;

/** integration spec이 설정·동의 행의 외래 키로 넣는 User 행 */
export function createUserSettingsFixtureUsers(): User[] {
  return [
    UserFixture.create({
      id: USER_SETTINGS_FIXTURE_USER_ID,
      email: "settings-owner@example.com",
      userTag: "SETOWN01",
    }),
    UserFixture.create({
      id: USER_SETTINGS_FIXTURE_OTHER_USER_ID,
      email: "settings-other@example.com",
      userTag: "SETOTH01",
    }),
    UserFixture.create({
      id: USER_SETTINGS_FIXTURE_INACTIVE_USER_ID,
      email: "settings-locked@example.com",
      userTag: "SETLCK01",
      status: "LOCKED",
    }),
    UserFixture.create({
      id: USER_SETTINGS_FIXTURE_DELETED_USER_ID,
      email: "settings-deleted@example.com",
      userTag: "SETDEL01",
      deletedAt: USER_SETTINGS_FIXTURE_NOW,
    }),
  ];
}
