import { userReportFormSchema as userReportFormContractSchema } from '@aido/api';
import type { z } from 'zod';

export const userReportFormSchema = userReportFormContractSchema;
export type UserReportFormValues = z.infer<typeof userReportFormSchema>;
