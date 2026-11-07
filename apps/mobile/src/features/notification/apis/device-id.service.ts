import type { DeviceIdStore } from '@src/core/ports/device-id-store';
import type { IdGenerator } from '@src/core/ports/id-generator';
import type { VendorIdGateway } from '@src/core/ports/vendor-id-gateway';

export class DeviceIdService {
  readonly #store: DeviceIdStore;
  readonly #vendorIdGateway: VendorIdGateway;
  readonly #idGenerator: IdGenerator;

  constructor(store: DeviceIdStore, vendorIdGateway: VendorIdGateway, idGenerator: IdGenerator) {
    this.#store = store;
    this.#vendorIdGateway = vendorIdGateway;
    this.#idGenerator = idGenerator;
  }

  get = async (): Promise<string> => {
    const storedId = await this.#store.get();
    if (storedId) {
      return storedId;
    }

    const platformId = (await this.#vendorIdGateway.get()) ?? this.#idGenerator.create();
    const deviceId = `${process.env.EXPO_OS}_${platformId}`;
    await this.#store.save(deviceId);

    return deviceId;
  };

  clear = (): Promise<void> => this.#store.remove();
}
