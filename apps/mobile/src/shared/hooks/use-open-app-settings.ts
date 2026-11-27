import { useExternalLink, useLogger } from '@src/shared/di/shared-di-context';
import { getErrorMessage } from '@src/shared/errors';

import { OPEN_URL_LOG_EVENT } from '../constants/open-url-log-events';

type AppSettingsOpenResult = { isOpened: true } | { isOpened: false; error: unknown };

export interface AppSettings {
  /** 이 앱의 설정 화면이 있는 기기인지. 없으면(Mac) 버튼 대신 시스템 설정으로 가는 길을 글로 보인다 */
  canOpen: boolean;
  /** 거절한 권한을 켜러 이 앱의 설정 화면을 연다. 실패는 로그로 남기고 reject하지 않는다 */
  open: () => Promise<AppSettingsOpenResult>;
}

/** 권한을 거절한 뒤 설정 앱으로 가는 유일한 길. 기능은 문구와 배치만 정한다 */
export function useOpenAppSettings(): AppSettings {
  const externalLink = useExternalLink();
  const logger = useLogger();

  const open = async (): Promise<AppSettingsOpenResult> => {
    try {
      await externalLink.openSettings();
      return { isOpened: true };
    } catch (error) {
      logger.warn(OPEN_URL_LOG_EVENT.SETTINGS_OPEN_FAILED, { error: getErrorMessage(error) });
      return { isOpened: false, error };
    }
  };

  return { canOpen: externalLink.canOpenSettings, open };
}
