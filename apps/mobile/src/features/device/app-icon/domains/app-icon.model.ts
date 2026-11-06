import { type AppIconKey, appIconKeySchema } from '../schemas/app-icon.schema';

/** 네이티브가 모르는 이름(옛 버전이나 앞선 버전의 아이콘)이면 기본 아이콘으로 본다 */
function resolveAppIconKey(nativeKey: string | null): AppIconKey {
  const result = appIconKeySchema.safeParse(nativeKey);

  return result.success ? result.data : 'default';
}

/** 기본 아이콘은 네이티브에서 이름이 없다(null) */
function getNativeAppIconName(key: AppIconKey): AppIconKey | null {
  return key === 'default' ? null : key;
}

/** 기본 아이콘만 누구나 쓸 수 있고 나머지는 구독 기능이다 */
function requiresPremium(key: AppIconKey) {
  return key !== 'default';
}

export const AppIconPolicy = { resolveAppIconKey, getNativeAppIconName, requiresPremium } as const;
