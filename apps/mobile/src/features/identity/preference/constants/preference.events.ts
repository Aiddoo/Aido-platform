import type { AppIconKey } from '@src/features/device/app-icon/domains/app-icon.model';
import type { FontScale } from '@src/shared/preferences/font-scale.preference';
import type { LanguageMode } from '@src/shared/preferences/language.preference';
import type { ThemeMode } from '@src/shared/preferences/theme-mode.preference';

import type { PreferenceChange } from '../schemas/preference-request.schema';

/** 서버 설정은 계약 칸 이름(camelCase), 날씨 알림 토글은 weatherEnabled 하나, 기기 설정은 snake_case다. 대시보드 값이라 바꾸지 않는다 */
type SettingName =
  | keyof PreferenceChange
  | 'weatherEnabled'
  | 'theme'
  | 'language'
  | 'font_scale'
  | 'app_icon'
  | 'voice_storage';

/** 서버 설정 값은 글자로 바꿔 보낸다(켜고 끔은 'true'·'false', 시각은 숫자) */
type SettingValue =
  | `${NonNullable<PreferenceChange[keyof PreferenceChange]>}`
  | ThemeMode
  | LanguageMode
  | FontScale
  | AppIconKey
  | 'remove_all'
  | 'remove_one';

declare module '@src/shared/analytics/event-map' {
  interface AppEventMap {
    settings_changed: { setting: SettingName; value: SettingValue };
  }
}
