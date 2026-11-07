import type { DeviceIdStore } from '@src/core/ports/device-id-store';
import type { IdGenerator } from '@src/core/ports/id-generator';
import type { VendorIdGateway } from '@src/core/ports/vendor-id-gateway';

interface DeviceIdServicePorts {
  store: DeviceIdStore;
  vendorIdGateway: VendorIdGateway;
  idGenerator: IdGenerator;
  /** 저장하는 기기 id의 접두사다. 이미 저장된 id와 같은 `ios`, `android` 값을 쓴다 */
  platform: string;
}

export class DeviceIdService {
  readonly #store: DeviceIdStore;
  readonly #vendorIdGateway: VendorIdGateway;
  readonly #idGenerator: IdGenerator;
  readonly #platform: string;

  constructor({ store, vendorIdGateway, idGenerator, platform }: DeviceIdServicePorts) {
    this.#store = store;
    this.#vendorIdGateway = vendorIdGateway;
    this.#idGenerator = idGenerator;
    this.#platform = platform;
  }

  get = async (): Promise<string> => {
    const storedId = await this.#store.get();
    if (storedId) {
      return storedId;
    }

    const platformId = (await this.#vendorIdGateway.get()) ?? this.#idGenerator.create();
    const deviceId = `${this.#platform}_${platformId}`;
    await this.#store.save(deviceId);

    return deviceId;
  };

  clear = (): Promise<void> => this.#store.clear();
}
