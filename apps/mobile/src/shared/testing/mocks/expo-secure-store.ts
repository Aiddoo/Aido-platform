/**
 * Mock implementation of expo-secure-store for Jest tests.
 * Uses in-memory storage to simulate SecureStore behavior.
 */

const store = new Map<string, string>();

export const getItemAsync = jest.fn(async (key: string): Promise<string | null> => {
  return store.get(key) ?? null;
});

export const setItemAsync = jest.fn(async (key: string, value: string): Promise<void> => {
  store.set(key, value);
});

export const deleteItemAsync = jest.fn(async (key: string): Promise<void> => {
  store.delete(key);
});

export const isAvailableAsync = jest.fn(async (): Promise<boolean> => {
  return true;
});

/**
 * Helper function to clear the mock store between tests.
 * Call this in beforeEach/afterEach to ensure test isolation.
 */
export const __clearStore = (): void => {
  store.clear();
};

/**
 * Helper function to get all stored items (for debugging).
 */
export const __getStore = (): Map<string, string> => {
  return new Map(store);
};
