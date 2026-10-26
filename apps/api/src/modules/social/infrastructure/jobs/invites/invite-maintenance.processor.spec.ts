import { mock } from "vitest-mock-extended";

import type { JobRuntimePort } from "#api/shared/application/ports/job-runtime.port";

import { InviteMaintenanceProcessor } from "./invite-maintenance.processor.js";
import {
  INVITE_MAINTENANCE_JOB_NAME,
  INVITE_QUALIFY_REMINDER_JOB_NAME,
} from "./invite-reward-queue.constants.js";

function createProcessor() {
  const calls: string[] = [];
  const processor = new InviteMaintenanceProcessor(
    {
      execute: async () => {
        calls.push("expire");
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
    mock<JobRuntimePort>(),
  );
  return { processor, calls };
}

describe("InviteMaintenanceProcessor", () => {
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
    { label: "등록된 일정", data: { name: INVITE_MAINTENANCE_JOB_NAME, data: {} } },
    { label: "알 수 없는 payload", data: {} },
  ])("$label은 정비 실행으로 마감 처리 뒤 알림을 예약한다", async ({ data }) => {
    // Given
    const { processor, calls } = createProcessor();

    // When
    await processor.handle({ data });

    // Then
    expect(calls).toEqual(["expire", "schedule-reminders"]);
  });
});
