/**
 * Database service mock type definition
 */
interface MockTodoDelegate {
	findMany: jest.Mock;
	findUnique: jest.Mock;
	findFirst: jest.Mock;
	create: jest.Mock;
	update: jest.Mock;
	delete: jest.Mock;
	count: jest.Mock;
}

interface MockDatabaseService {
	todo: MockTodoDelegate;
	$connect: jest.Mock;
	$disconnect: jest.Mock;
	$queryRaw: jest.Mock;
	$executeRaw: jest.Mock;
	$transaction: jest.Mock;
}

/**
 * Database service mock for unit testing
 */
export const mockDatabaseService: MockDatabaseService = {
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
	$transaction: jest.fn(
		(fn: (prisma: MockDatabaseService) => Promise<unknown>) =>
			fn(mockDatabaseService),
	),
};

/**
 * Creates a fresh mock database service instance
 * Use this to reset mocks between tests
 */
export const createMockDatabaseService = (): MockDatabaseService => ({
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
export const resetDatabaseMocks = (): void => {
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
