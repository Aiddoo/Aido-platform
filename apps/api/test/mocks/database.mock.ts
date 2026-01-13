/**
 * Database service mock for unit testing
 */
export const mockDatabaseService = {
	todo: {
		findMany: jest.fn(),
		findUnique: jest.fn(),
		findFirst: jest.fn(),
		create: jest.fn(),
		update: jest.fn(),
		delete: jest.fn(),
		count: jest.fn(),
	},
	$connect: jest.fn(),
	$disconnect: jest.fn(),
	$queryRaw: jest.fn(),
	$executeRaw: jest.fn(),
	$transaction: jest.fn((fn: (prisma: unknown) => Promise<unknown>) =>
		fn(mockDatabaseService),
	),
};

/**
 * Creates a fresh mock database service instance
 * Use this to reset mocks between tests
 */
export const createMockDatabaseService = () => ({
	todo: {
		findMany: jest.fn(),
		findUnique: jest.fn(),
		findFirst: jest.fn(),
		create: jest.fn(),
		update: jest.fn(),
		delete: jest.fn(),
		count: jest.fn(),
	},
	$connect: jest.fn(),
	$disconnect: jest.fn(),
	$queryRaw: jest.fn(),
	$executeRaw: jest.fn(),
	$transaction: jest.fn(),
});

/**
 * Reset all mocks in the database service
 */
export const resetDatabaseMocks = () => {
	Object.values(mockDatabaseService.todo).forEach((mock) => {
		if (typeof mock === "function" && "mockReset" in mock) {
			(mock as jest.Mock).mockReset();
		}
	});
	mockDatabaseService.$connect.mockReset();
	mockDatabaseService.$disconnect.mockReset();
	mockDatabaseService.$queryRaw.mockReset();
	mockDatabaseService.$executeRaw.mockReset();
	mockDatabaseService.$transaction.mockReset();
};
