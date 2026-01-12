/**
 * TodoRepository 단위 테스트
 *
 * @description
 * Repository 계층의 Prisma 데이터 접근 로직을 검증합니다.
 * PrismaService를 모킹하여 실제 DB 없이 테스트합니다.
 *
 * 테스트 전략:
 * - PrismaService 메서드들을 jest.fn()으로 모킹
 * - Repository에 모킹된 PrismaService 주입
 * - 각 메서드가 올바른 Prisma 메서드를 올바른 인자로 호출하는지 검증
 *
 * 사용 라이브러리:
 * - jest: 테스트 프레임워크 및 모킹
 */

import type { Todo } from '../generated/prisma/client';
import { TodoRepository } from './todo.repository';

describe('TodoRepository', () => {
  let repository: TodoRepository;
  let mockPrismaService: {
    todo: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };

  // 테스트용 Mock 데이터
  const mockTodo: Todo = {
    id: 1,
    title: 'Test Todo',
    content: 'Test Content',
    completed: false,
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-01T00:00:00.000Z'),
  };

  const mockTodos: Todo[] = [
    mockTodo,
    {
      id: 2,
      title: 'Second Todo',
      content: null,
      completed: true,
      createdAt: new Date('2024-01-02T00:00:00.000Z'),
      updatedAt: new Date('2024-01-02T00:00:00.000Z'),
    },
  ];

  beforeEach(() => {
    // PrismaService 모킹 객체 생성
    mockPrismaService = {
      todo: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    // Repository 인스턴스 생성 시 모킹된 PrismaService 주입
    // biome-ignore lint/suspicious/noExplicitAny: Mock object for testing
    repository = new TodoRepository(mockPrismaService as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ===========================================================================
  // 인스턴스 테스트
  // ===========================================================================

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  // ===========================================================================
  // findAll() 테스트
  // ===========================================================================

  describe('findAll()', () => {
    it('should return all todos ordered by createdAt desc', async () => {
      // Arrange
      mockPrismaService.todo.findMany.mockResolvedValue(mockTodos);

      // Act
      const result = await repository.findAll();

      // Assert
      expect(result).toEqual(mockTodos);
      expect(mockPrismaService.todo.findMany).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.todo.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return empty array when no todos exist', async () => {
      // Arrange
      mockPrismaService.todo.findMany.mockResolvedValue([]);

      // Act
      const result = await repository.findAll();

      // Assert
      expect(result).toEqual([]);
      expect(mockPrismaService.todo.findMany).toHaveBeenCalledTimes(1);
    });
  });

  // ===========================================================================
  // findById() 테스트
  // ===========================================================================

  describe('findById()', () => {
    it('should return a todo when found', async () => {
      // Arrange
      mockPrismaService.todo.findUnique.mockResolvedValue(mockTodo);

      // Act
      const result = await repository.findById(1);

      // Assert
      expect(result).toEqual(mockTodo);
      expect(mockPrismaService.todo.findUnique).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.todo.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });

    it('should return null when todo not found', async () => {
      // Arrange
      mockPrismaService.todo.findUnique.mockResolvedValue(null);

      // Act
      const result = await repository.findById(999);

      // Assert
      expect(result).toBeNull();
      expect(mockPrismaService.todo.findUnique).toHaveBeenCalledWith({
        where: { id: 999 },
      });
    });
  });

  // ===========================================================================
  // create() 테스트
  // ===========================================================================

  describe('create()', () => {
    it('should create and return a new todo with title and content', async () => {
      // Arrange
      const createData = { title: 'New Todo', content: 'New Content' };
      const createdTodo: Todo = {
        ...mockTodo,
        ...createData,
      };
      mockPrismaService.todo.create.mockResolvedValue(createdTodo);

      // Act
      const result = await repository.create(createData);

      // Assert
      expect(result).toEqual(createdTodo);
      expect(mockPrismaService.todo.create).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.todo.create).toHaveBeenCalledWith({
        data: createData,
      });
    });

    it('should create a todo with title only (no content)', async () => {
      // Arrange
      const createData = { title: 'Title Only Todo' };
      const createdTodo: Todo = {
        ...mockTodo,
        title: 'Title Only Todo',
        content: null,
      };
      mockPrismaService.todo.create.mockResolvedValue(createdTodo);

      // Act
      const result = await repository.create(createData);

      // Assert
      expect(result).toEqual(createdTodo);
      expect(mockPrismaService.todo.create).toHaveBeenCalledWith({
        data: createData,
      });
    });
  });

  // ===========================================================================
  // update() 테스트
  // ===========================================================================

  describe('update()', () => {
    it('should update and return the todo with new title', async () => {
      // Arrange
      const updateData = { title: 'Updated Title' };
      const updatedTodo: Todo = {
        ...mockTodo,
        ...updateData,
      };
      mockPrismaService.todo.update.mockResolvedValue(updatedTodo);

      // Act
      const result = await repository.update(1, updateData);

      // Assert
      expect(result).toEqual(updatedTodo);
      expect(mockPrismaService.todo.update).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.todo.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: updateData,
      });
    });

    it('should update completed status', async () => {
      // Arrange
      const updateData = { completed: true };
      const updatedTodo: Todo = {
        ...mockTodo,
        completed: true,
      };
      mockPrismaService.todo.update.mockResolvedValue(updatedTodo);

      // Act
      const result = await repository.update(1, updateData);

      // Assert
      expect(result.completed).toBe(true);
      expect(mockPrismaService.todo.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: updateData,
      });
    });

    it('should update multiple fields at once', async () => {
      // Arrange
      const updateData = {
        title: 'New Title',
        content: 'New Content',
        completed: true,
      };
      const updatedTodo: Todo = {
        ...mockTodo,
        ...updateData,
      };
      mockPrismaService.todo.update.mockResolvedValue(updatedTodo);

      // Act
      const result = await repository.update(1, updateData);

      // Assert
      expect(result).toEqual(updatedTodo);
      expect(mockPrismaService.todo.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: updateData,
      });
    });
  });

  // ===========================================================================
  // delete() 테스트
  // ===========================================================================

  describe('delete()', () => {
    it('should delete and return the deleted todo', async () => {
      // Arrange
      mockPrismaService.todo.delete.mockResolvedValue(mockTodo);

      // Act
      const result = await repository.delete(1);

      // Assert
      expect(result).toEqual(mockTodo);
      expect(mockPrismaService.todo.delete).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.todo.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });

    it('should call delete with correct id parameter', async () => {
      // Arrange
      const todoToDelete: Todo = { ...mockTodo, id: 42 };
      mockPrismaService.todo.delete.mockResolvedValue(todoToDelete);

      // Act
      const result = await repository.delete(42);

      // Assert
      expect(result.id).toBe(42);
      expect(mockPrismaService.todo.delete).toHaveBeenCalledWith({
        where: { id: 42 },
      });
    });
  });
});
