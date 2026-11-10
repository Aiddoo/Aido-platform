export abstract class MarketingPushOptOutTokenPort {
  abstract issue(userId: string): string;
  abstract verify(token: string): string | null;
}
