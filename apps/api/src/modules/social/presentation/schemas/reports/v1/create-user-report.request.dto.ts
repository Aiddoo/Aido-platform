import { createUserReportSchema } from "@aido/api";
import type { z } from "zod";

export const CreateUserReportDto = createUserReportSchema.meta({ id: "CreateUserReportDto" });
export type CreateUserReportDto = z.infer<typeof CreateUserReportDto>;
