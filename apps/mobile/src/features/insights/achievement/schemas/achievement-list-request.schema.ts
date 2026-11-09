import { getWeeklyAchievementsQuerySchema } from '@aido/api';
import type { z } from 'zod';

/** 계약은 문자열 query를 숫자로 바꿔 입력 타입이 unknown이다. 앱은 바꾼 뒤의 값을 보내고 기본값이 있는 칸은 생략한다 */
const getAchievementsQuerySchema = getWeeklyAchievementsQuerySchema.partial({ size: true });
export type GetAchievementsQuery = z.output<typeof getAchievementsQuerySchema>;
