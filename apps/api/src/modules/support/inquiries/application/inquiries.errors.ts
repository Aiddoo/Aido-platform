import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/application/application.exception";

export function inquiryDeliveryFailed(userId: string): ApplicationException {
  return new ApplicationException(ErrorCode.INQUIRY_1501, { userId });
}
