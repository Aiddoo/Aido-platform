import { isEqual } from 'es-toolkit';

import { DeviceTimezonePolicy } from '../domains/device-timezone.model';
import type { DeviceTimezone, DeviceTimezoneChange } from '../domains/device-timezone.model';
import type { DeviceTimezoneRepository } from './device-timezone.repository';

export class DeviceTimezoneService {
  readonly #repository: DeviceTimezoneRepository;

  constructor(repository: DeviceTimezoneRepository) {
    this.#repository = repository;
  }

  record = (userId: string, current: DeviceTimezone): DeviceTimezoneChange | null => {
    const previous = this.#repository.find(userId);
    if (previous == null || !isEqual(previous, current)) {
      this.#repository.save(userId, current);
    }
    if (previous == null || !DeviceTimezonePolicy.hasDeviceTimezoneChanged(previous, current)) {
      return null;
    }
    return { previous, current };
  };

  clear = (): void => this.#repository.clear();
}
