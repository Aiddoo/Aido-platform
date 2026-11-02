import { createUserReportResponseSchema } from "@aido/api";
import type { z } from "zod";

export const CreateUserReportResponseDto = createUserReportResponseSchema.meta({
  id: "CreateUserReportResponseDto",
});
export type CreateUserReportResponseDto = z.infer<typeof CreateUserReportResponseDto>;
