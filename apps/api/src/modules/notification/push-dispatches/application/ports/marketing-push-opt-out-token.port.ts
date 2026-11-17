import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

export abstract class MarketingPushOptOutTokenPort {
  abstract issue(userId: UserId): string;
  abstract verify(token: string): UserId | null;
}
