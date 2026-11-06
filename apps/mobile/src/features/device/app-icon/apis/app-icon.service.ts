import type { AppIconGateway } from '@src/core/ports/app-icon-gateway';

import { AppIconPolicy } from '../domains/app-icon.model';
import type { AppIconKey } from '../schemas/app-icon.schema';

export class AppIconService {
  readonly #gateway: AppIconGateway;
  #pendingChange: Promise<AppIconKey> | null = null;

  constructor(gateway: AppIconGateway) {
    this.#gateway = gateway;
  }

  isSupported = (): boolean => this.#gateway.isSupported();

  getCurrentIcon = async (signal?: AbortSignal): Promise<AppIconKey> => {
    const nativeKey = await this.#gateway.getCurrentIcon();
    if (signal?.aborted) {
      throw new Error('App icon lookup cancelled');
    }
    return AppIconPolicy.resolveAppIconKey(nativeKey);
  };

  changeIcon = (key: AppIconKey): Promise<AppIconKey> => {
    if (this.#pendingChange) {
      return this.#pendingChange;
    }

    const operation = this.#gateway
      .changeIcon(AppIconPolicy.getNativeAppIconName(key))
      .then((nativeKey) => AppIconPolicy.resolveAppIconKey(nativeKey));
    const pendingChange = operation.finally(() => {
      if (this.#pendingChange === pendingChange) {
        this.#pendingChange = null;
      }
    });
    this.#pendingChange = pendingChange;
    return pendingChange;
  };
}
