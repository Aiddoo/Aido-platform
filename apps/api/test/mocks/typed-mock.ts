import { type MockProxy, mock } from "vitest-mock-extended";

export function mockOf<T extends object>(impl?: Partial<T>): MockProxy<T> {
	return Object.assign(mock<T>(), impl);
}

export function asDep<T extends object>(impl: Partial<T>): T {
	return Object.setPrototypeOf(mock<T>(), impl);
}
