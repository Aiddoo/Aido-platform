import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { InMemoryJobQueue } from "#test/doubles/platform/in-memory-job-queue";

import { InviteMaintenanceProcessor } from "./invite-maintenance.processor.js";
import {
  INVITE_MAINTENANCE_JOB_NAME,
  INVITE_QUALIFY_REMINDER_JOB_NAME,
} from "./invite-reward.queue.js";

// 2028-03-01 03:30 KST에 도는 정비. UTC로는 아직 2월 29일이다
const NOW = Temporal.Instant.from("2028-02-29T18:30:00Z");

function createProcessor() {
  const calls: string[] = [];
  const processor = new InviteMaintenanceProcessor(
    {
      execute: async ({ runDate }) => {
        calls.push(`expire:${runDate.toString()}`);
        return { expiredCount: 0, retriedCount: 0 };
      },
    },
    {
      execute: async () => {
        calls.push("schedule-reminders");
        return { scheduledCount: 0 };
      },
    },
    {
      execute: async ({ redemptionId }) => {
        calls.push(`send-reminder:${redemptionId}`);
        return { status: "sent" };
      },
    },
    new InMemoryJobQueue(),
    new FixedClock(NOW),
  );
  return { processor, calls };
}

describe("InviteMaintenanceProcessor — 초대 정비 큐 소비", () => {
  it("사용 시작 알림 작업은 그 수락의 알림만 보내고 정비를 다시 돌리지 않는다", async () => {
    // Given
    const { processor, calls } = createProcessor();

    // When
    await processor.handle({
      data: { name: INVITE_QUALIFY_REMINDER_JOB_NAME, data: { redemptionId: "redemption-1" } },
    });

    // Then
    expect(calls).toEqual(["send-reminder:redemption-1"]);
  });

  it.each([
    { label: "등록된 일정", data: { name: INVITE_MAINTENANCE_JOB_NAME } },
    { label: "name이 없는 옛 payload", data: {} },
  ] as const)("$label은 서울 날짜로 마감 처리한 뒤 알림을 예약한다", async ({ data }) => {
    // Given
    const { processor, calls } = createProcessor();

    // When
    await processor.handle({ data });

    // Then
    expect(calls).toEqual(["expire:2028-03-01", "schedule-reminders"]);
  });
});
