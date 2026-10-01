import { vi } from "vitest";

export function createMockDatabaseService<T extends Record<string, object>>(models: T) {
	const service = {
		...models,
		$transaction: vi.fn<(callback: (tx: T) => Promise<unknown>) => Promise<unknown>>(),
	};

	service.$transaction.mockImplementation((callback) => callback(service));
	return service;
}
