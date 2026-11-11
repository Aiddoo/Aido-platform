import type { AppIconGateway } from '@src/core/ports/app-icon-gateway';

import { toAppIconKey, toNativeAppIconName } from '../apis/app-icon.mapper';
import type { AppIconKey } from '../domains/app-icon.model';

export class AppIconService {
  readonly #gateway: AppIconGateway;
  #pendingChange: Promise<AppIconKey> | null = null;

  constructor(gateway: AppIconGateway) {
    this.#gateway = gateway;
  }

  isAvailable = (): boolean => this.#gateway.isAvailable();

  getCurrentIcon = async (signal?: AbortSignal): Promise<AppIconKey> => {
    const nativeKey = await this.#gateway.getCurrentIcon();
    if (signal?.aborted) {
      throw new Error('App icon lookup cancelled');
    }
    return toAppIconKey(nativeKey);
  };

  changeIcon = (key: AppIconKey): Promise<AppIconKey> => {
    if (this.#pendingChange) {
      return this.#pendingChange;
    }

    const operation = this.#gateway.changeIcon(toNativeAppIconName(key)).then(toAppIconKey);
    const pendingChange = operation.finally(() => {
      if (this.#pendingChange === pendingChange) {
        this.#pendingChange = null;
      }
    });
    this.#pendingChange = pendingChange;
    return pendingChange;
  };
}
