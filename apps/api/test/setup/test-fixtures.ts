/**
 * Test data factory for creating consistent test fixtures
 */

let todoCounter = 0;

export const TodoFixture = {
	create: (
		overrides: Partial<{
			title: string;
			content: string | null;
			completed: boolean;
		}> = {},
	) => ({
		title: `Test Todo ${++todoCounter}`,
		content: `Test content ${todoCounter}`,
		completed: false,
		...overrides,
	}),

	createMany: (
		count: number,
		overrides: Partial<{
			title: string;
			content: string | null;
			completed: boolean;
		}> = {},
	) =>
		Array.from({ length: count }, (_, i) =>
			TodoFixture.create({
				title: `Test Todo ${todoCounter + i + 1}`,
				...overrides,
			}),
		),

	reset: () => {
		todoCounter = 0;
	},
};

export const UserFixture = {
	create: (overrides: Partial<{ email: string; name: string }> = {}) => ({
		email: `test${Date.now()}@example.com`,
		name: "Test User",
		...overrides,
	}),
};
