import { z } from 'zod';

/** 서버가 사람을 보여 줄 때 싣는 공통 칸. 화면마다 필요한 칸만 pick·extend로 가져다 쓴다 */
export const userSummarySchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  userTag: z.string(),
  profileImage: z.string().nullable(),
});
