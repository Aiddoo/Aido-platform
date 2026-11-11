import type { OperationalAlert } from "#api/shared/application/ports/operational-alert.port";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { RecordingOperationalAlert } from "#test/doubles/platform/recording-operational-alert";

import {
  DeduplicatingOperationalAlertAdapter,
  OPERATIONAL_ALERT_LIMITS,
} from "./deduplicating-operational-alert.adapter.js";

const START = Temporal.Instant.from("2026-11-10T00:00:00Z");
const REPEAT_INTERVAL_MS = OPERATIONAL_ALERT_LIMITS.repeatIntervalMs;

// 감싸기는 key를 그대로 비교하므로 카탈로그 없이 key만 바꾼 경보를 쓴다
function alert(key: string): OperationalAlert {
  return {
    key,
    context: "job",
    severity: "error",
    summary: "작업이 재시도를 모두 쓰고 실패했다",
    runbook: "로그를 본다",
  };
}

function setup() {
  const clock = new FixedClock(START);
  const delegate = new RecordingOperationalAlert();
  const alerts = new DeduplicatingOperationalAlertAdapter(delegate, clock);
  const raisedKeys = () => delegate.alerts.map(({ key }) => key);
  return { clock, alerts, raisedKeys };
}

describe("DeduplicatingOperationalAlertAdapter — 운영 경보 전송 한도", () => {
  it("같은 key는 반복 간격 안에서 한 번만 보낸다", () => {
    // Given
    const { clock, alerts, raisedKeys } = setup();
    alerts.raise(alert("job.failed:report.v1:TypeError"));

    // When
    clock.advanceBy({ milliseconds: REPEAT_INTERVAL_MS - 1 });
    alerts.raise(alert("job.failed:report.v1:TypeError"));

    // Then
    expect(raisedKeys()).toEqual(["job.failed:report.v1:TypeError"]);
  });

  it("반복 간격이 지나면 같은 key를 다시 보낸다", () => {
    // Given
    const { clock, alerts, raisedKeys } = setup();
    alerts.raise(alert("schedule.overdue:daily"));

    // When
    clock.advanceBy({ milliseconds: REPEAT_INTERVAL_MS });
    alerts.raise(alert("schedule.overdue:daily"));

    // Then
    expect(raisedKeys()).toEqual(["schedule.overdue:daily", "schedule.overdue:daily"]);
  });

  it("다시 보내는 경보는 key가 달라도 시간당 상한까지만 보낸다", () => {
    // Given
    const { clock, alerts, raisedKeys } = setup();
    const keys = ["a", "b", "c"];
    keys.forEach((key) => alerts.raise(alert(key)));
    clock.advanceBy({ milliseconds: REPEAT_INTERVAL_MS });

    // When
    keys.forEach((key) => alerts.raise(alert(key)));

    // Then
    expect(raisedKeys()).toEqual([
      ...keys,
      ...keys.slice(0, OPERATIONAL_ALERT_LIMITS.maxRepeatsPerHour),
    ]);
  });

  it("반복 상한을 다 써도 처음 보는 key는 보낸다", () => {
    // Given
    const { clock, alerts, raisedKeys } = setup();
    ["a", "b", "c"].forEach((key) => alerts.raise(alert(key)));
    clock.advanceBy({ milliseconds: REPEAT_INTERVAL_MS });
    ["a", "b", "c"].forEach((key) => alerts.raise(alert(key)));

    // When
    alerts.raise(alert("queue.dead-letter:push-delivery-dead-letter.v1"));

    // Then
    expect(raisedKeys().at(-1)).toBe("queue.dead-letter:push-delivery-dead-letter.v1");
  });
});
