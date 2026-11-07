import { z } from 'zod';

/** 친구 초대로 들어온 곳. 누른 순간 invite_entry_tapped로 남긴다 */
const inviteEntrySourceSchema = z.enum([
  'friends_empty',
  'friend_strip_empty',
  'friend_limit_dialog',
  'mypage_card',
  'activation_checklist',
  'all_done_banner',
]);

export type InviteEntrySource = z.output<typeof inviteEntrySourceSchema>;
