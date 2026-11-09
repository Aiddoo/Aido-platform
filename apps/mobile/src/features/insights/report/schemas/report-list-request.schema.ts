import { getAiReportsQuerySchema } from '@aido/api';
import type { z } from 'zod';

/** 계약은 문자열 query를 숫자로 바꿔 입력 타입이 unknown이다. 앱은 바꾼 뒤의 값을 보내고 모든 칸을 생략할 수 있다 */
const getReportsQuerySchema = getAiReportsQuerySchema.partial();
export type GetAiReportsQuery = z.output<typeof getReportsQuerySchema>;
