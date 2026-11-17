import { ErrorCode } from "@aido/api/errors";

import type { MeteredFeatureQuota } from "#api/modules/access/quotas/access-quotas.public";
import { ApplicationException } from "#api/shared/application/application.exception";

/** 녹음이 이번 등급의 한 번 길이를 넘었다. 예약 전이라 차감하지 않았다 */
export function voiceNoteTooLong(
  featureQuota: MeteredFeatureQuota,
  characterCount: number,
  maxCharacters: number,
): ApplicationException {
  return new ApplicationException(ErrorCode.AI_1312, {
    charged: false,
    featureQuota,
    characterCount,
    maxCharacters,
  });
}
