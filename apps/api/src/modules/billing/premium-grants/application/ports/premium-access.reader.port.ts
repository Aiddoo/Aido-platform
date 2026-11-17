import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { PremiumAccessReadModel } from "../read-models/premium-access.read-model.js";

/** 스토어 구독과 보상 기간을 함께 본 현재 프리미엄 출처·종료 시각 */
export abstract class PremiumAccessReaderPort {
  abstract getPremiumAccess(userId: UserId): Promise<PremiumAccessReadModel>;
}
