export interface DeviceIdRepository {
  get: () => Promise<string | null>;
  save: (deviceId: string) => Promise<void>;
  remove: () => Promise<void>;
}
