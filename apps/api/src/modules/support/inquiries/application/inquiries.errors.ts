import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/application/application.exception";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

export function inquiryDeliveryFailed(userId: UserId): ApplicationException {
  return new ApplicationException(ErrorCode.INQUIRY_1501, { userId: userId.value });
}
