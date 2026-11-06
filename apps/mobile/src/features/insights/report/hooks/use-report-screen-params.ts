import { useLocalSearchParams } from 'expo-router';

import { reportScreenParamsSchema } from '../schemas/report-params.schema';

export function useReportScreenParams() {
  return reportScreenParamsSchema.parse(useLocalSearchParams());
}
