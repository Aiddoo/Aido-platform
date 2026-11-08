import type { UpdateProfileInput } from '@aido/api';

/** 이름이나 프로필 사진 중 바꿀 칸만 담는다. profileImage null은 사진 지우기다 */
export type ProfileChange = UpdateProfileInput;
