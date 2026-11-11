export abstract class ClockPort {
  abstract now(): Temporal.Instant;
}
