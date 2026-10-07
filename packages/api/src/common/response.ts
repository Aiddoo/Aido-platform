import { z } from "zod";

/** JSON 성공 응답. Timestamp는 기존 앱과 동일한 epoch milliseconds다. */
export const successEnvelopeSchema = z.object({
  success: z.literal(true),
  data: z.unknown(),
  timestamp: z.number(),
});

export interface SuccessResponse<T = unknown> {
  success: true;
  data: T;
  timestamp: number;
}
