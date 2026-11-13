import { type UpdateProfileInput, updateProfileSchema } from '@aido/api';

/** profileImage null은 사진 지우기다 */
export type ProfileChange = UpdateProfileInput;

/** 프로필 수정 지표(profile_edited.field)가 칸 이름을 그대로 보낸다 */
export const PROFILE_FIELDS = updateProfileSchema.keyof().options;
