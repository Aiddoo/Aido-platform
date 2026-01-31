/**
 * Repository interface for device ID persistence
 * Uses SecureStore for iOS Keychain persistence
 */
export interface DeviceIdRepository {
  get: () => Promise<string | null>;
  save: (deviceId: string) => Promise<void>;
  remove: () => Promise<void>;
}
