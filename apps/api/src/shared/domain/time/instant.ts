// Date#toISOString과 바이트 단위로 같아야 출시 앱 응답이 바뀌지 않는다(ms 3자리, Date처럼 내림)
export function toIsoString(instant: Temporal.Instant): string {
  return instant.toString({ fractionalSecondDigits: 3, roundingMode: "floor" });
}

export function instantFromDate(date: Date): Temporal.Instant {
  return Temporal.Instant.fromEpochMilliseconds(date.getTime());
}

export function instantToDate(instant: Temporal.Instant): Date {
  return new Date(instant.epochMilliseconds);
}
