import { planReminderJobs, REMINDER_STAGES } from "./reminder-plan.domain-service.js";

const NOW = 1_000_000_000;
const MINUTE_MS = 60_000;

describe("리마인더 예약 계획", () => {
  it.each([
    { name: "2시간 뒤", minutes: 120, labels: ["60min", "10min"] },
    { name: "60분 1초 뒤", minutes: 60 + 1 / 60, labels: ["60min", "10min"] },
    { name: "정확히 60분 뒤", minutes: 60, labels: ["10min"] },
    { name: "30분 뒤", minutes: 30, labels: ["10min"] },
    { name: "10분 1초 뒤", minutes: 10 + 1 / 60, labels: ["10min"] },
    { name: "정확히 10분 뒤", minutes: 10, labels: [] },
    { name: "5분 뒤", minutes: 5, labels: [] },
    { name: "지금", minutes: 0, labels: [] },
    { name: "1분 전", minutes: -1, labels: [] },
  ])("$name이면 앞으로 남은 단계만 예약한다", ({ minutes, labels }) => {
    // Given
    const scheduledMs = NOW + minutes * MINUTE_MS;
    // When
    const jobs = planReminderJobs(scheduledMs, NOW);
    // Then
    expect(jobs.map(({ label }) => label)).toEqual(labels);
    expect(jobs.every(({ delay }) => delay > 0)).toBe(true);
  });

  it("각 단계는 시각에서 리드 타임을 뺀 때 시작한다", () => {
    // Given
    const scheduledMs = NOW + 120 * MINUTE_MS;
    // When
    const jobs = planReminderJobs(scheduledMs, NOW);
    // Then
    expect(jobs.map(({ delay }) => delay)).toEqual(
      REMINDER_STAGES.map(({ leadTimeMs }) => 120 * MINUTE_MS - leadTimeMs),
    );
  });
});
