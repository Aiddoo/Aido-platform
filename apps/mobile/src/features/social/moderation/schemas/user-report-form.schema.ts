import { userReportFormSchema as userReportFormContractSchema } from '@aido/api/contracts/user-report/v1';
import type { z } from 'zod';

export const userReportFormSchema = userReportFormContractSchema;
export type UserReportFormValues = z.infer<typeof userReportFormSchema>;
