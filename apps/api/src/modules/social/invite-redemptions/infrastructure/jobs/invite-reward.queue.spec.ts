import { InviteRedemptionId } from "../../domain/invite-redemption-id.vo.js";
import { INVITEE_ACTIVITY_SUBSCRIPTION } from "../event-handlers/invitee-activity.event-handler.js";
import {
  INVITE_MAINTENANCE_QUEUE,
  INVITE_REWARD_QUEUE,
  InviteMaintenanceJobKey,
  InviteQualifyReminderJobKey,
  InviteRewardJobKey,
} from "./invite-reward.queue.js";
import { INVITEE_ACTIVITY_QUEUE } from "./invitee-activity.queue.js";

const REDEMPTION_ID = InviteRedemptionId.reconstitute("c0000000000000000000rdm01");

// 쌓인 작업·일정·멱등 key가 slice를 옮긴 뒤에도 같은 작업을 가리키도록 바이트 단위로 고정한다
describe("초대 수락 큐 계약", () => {
  it("큐 이름·일정 key·구독 이름은 slice를 나누기 전 문자열 그대로다", () => {
    // When
    const names = {
      reward: INVITE_REWARD_QUEUE.name,
      maintenance: INVITE_MAINTENANCE_QUEUE.name,
      maintenanceSchedules: INVITE_MAINTENANCE_QUEUE.schedules?.map((schedule) => schedule.key),
      inviteeActivity: INVITEE_ACTIVITY_QUEUE.name,
      subscription: INVITEE_ACTIVITY_SUBSCRIPTION.name,
    };

    // Then
    expect(names).toEqual({
      reward: "invite-reward.v1",
      maintenance: "invite-maintenance.v1",
      maintenanceSchedules: ["daily-invite-maintenance-scheduler"],
      inviteeActivity: "social.invitee-activity.v1",
      subscription: "social.invitee-activity",
    });
  });

  it("작업 key는 slice를 나누기 전 문자열 그대로다", () => {
    // When
    const keys = [
      InviteRewardJobKey.of(REDEMPTION_ID, { kind: "redeemed" }),
      InviteRewardJobKey.of(REDEMPTION_ID, { kind: "qualified" }),
      InviteRewardJobKey.of(REDEMPTION_ID, {
        kind: "retry",
        runDate: Temporal.PlainDate.from("2028-03-01"),
      }),
      InviteMaintenanceJobKey.catchUp(Temporal.PlainDate.from("2028-03-01")),
      InviteQualifyReminderJobKey.of(REDEMPTION_ID, Temporal.Instant.from("2028-03-02T09:00:00Z")),
    ];

    // Then
    expect(keys).toEqual([
      "invite-reward:c0000000000000000000rdm01:redeemed",
      "invite-reward:c0000000000000000000rdm01:qualified",
      "invite-reward:c0000000000000000000rdm01:retry:2028-03-01",
      "invite-maintenance_2028-03-01",
      "invite-qualify-reminder:c0000000000000000000rdm01:2028-03-02T09:00:00.000Z",
    ]);
  });
});
