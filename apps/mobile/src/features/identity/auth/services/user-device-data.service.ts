import type { Logger } from '@src/core/ports/logger';
import { getErrorMessage } from '@src/shared/errors';

import { AUTH_LOG_EVENT } from '../constants/auth-log-events';

/** 계정마다 기기에 남긴 안내·답 기록. 위층 기능의 저장소라 조립하는 곳이 넘긴다 */
interface UserScopedDeviceData {
  clear(userId: string): void;
}

interface UserDeviceDataServicePorts {
  /** 키는 실패를 남길 때 어느 저장소인지 알리는 이름이다 */
  repositories: Readonly<Record<string, UserScopedDeviceData>>;
  logger: Pick<Logger, 'warn'>;
}

/** 탈퇴한 계정의 기기 기록을 한 곳에서 지운다. 로그아웃은 같은 사람이 돌아오므로 남긴다 */
export class UserDeviceDataService {
  readonly #repositories: UserDeviceDataServicePorts['repositories'];
  readonly #logger: UserDeviceDataServicePorts['logger'];

  constructor({ repositories, logger }: UserDeviceDataServicePorts) {
    this.#repositories = repositories;
    this.#logger = logger;
  }

  /** 한 저장소가 실패해도 나머지는 지운다 */
  clearForUser = (userId: string): void => {
    Object.entries(this.#repositories).forEach(([name, repository]) => {
      try {
        repository.clear(userId);
      } catch (error) {
        this.#logger.warn(AUTH_LOG_EVENT.USER_DEVICE_DATA_CLEAR_FAILED, {
          repository: name,
          error: getErrorMessage(error),
        });
      }
    });
  };
}
