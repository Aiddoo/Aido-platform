import { type AppIconKey, appIconKeySchema } from '../schemas/app-icon.schema';

/** 네이티브가 모르는 이름(옛 버전이나 앞선 버전의 아이콘)이면 기본 아이콘으로 본다 */
export function toAppIconKey(nativeKey: string | null): AppIconKey {
  const result = appIconKeySchema.safeParse(nativeKey);

  return result.success ? result.data : 'default';
}

/** 기본 아이콘은 네이티브에서 이름이 없다(null) */
export function toNativeAppIconName(key: AppIconKey): AppIconKey | null {
  return key === 'default' ? null : key;
}
