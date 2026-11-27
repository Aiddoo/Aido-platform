import { type AppIconKey, appIconKeySchema } from '../domains/app-icon.model';

/** 네이티브에서 이름이 없는(null) 기본 아이콘 */
const NATIVE_UNNAMED_APP_ICON = 'default' satisfies AppIconKey;

/** 이름이 없거나 앱이 모르는 이름(옛 버전이나 앞선 버전의 아이콘)이면 기본 아이콘으로 본다 */
export function toAppIconKey(nativeKey: string | null): AppIconKey {
  const result = appIconKeySchema.safeParse(nativeKey);

  return result.success ? result.data : NATIVE_UNNAMED_APP_ICON;
}

export function toNativeAppIconName(key: AppIconKey): AppIconKey | null {
  return key === NATIVE_UNNAMED_APP_ICON ? null : key;
}
