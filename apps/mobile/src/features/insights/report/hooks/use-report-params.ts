import { useLocalSearchParams } from 'expo-router';

import { reportParamsSchema } from '../schemas/report-params.schema';

export function useReportParams() {
  return reportParamsSchema.parse(useLocalSearchParams());
}
