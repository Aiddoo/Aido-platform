import { z } from 'zod';

/** 초대 링크를 보내는 방법. 분석 이벤트 invite_link_shared.channel과 같은 값이다 */
const inviteShareChannelSchema = z.enum(['kakao', 'copy_link', 'system']);

export type InviteShareChannel = z.output<typeof inviteShareChannelSchema>;
