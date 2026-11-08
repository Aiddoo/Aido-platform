import type { AppIconKey } from '../schemas/app-icon.schema';

/** 기본 아이콘만 누구나 쓸 수 있고 나머지는 구독 기능이다 */
function isPremiumIcon(key: AppIconKey) {
  return key !== 'default';
}

export const AppIconPolicy = { isPremiumIcon } as const;
