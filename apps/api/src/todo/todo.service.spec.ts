/**
 * TodoService 단위 테스트
 *
 * @description
 * Service의 비즈니스 로직을 검증합니다.
 * TodoRepository를 모킹하여 Service만 격리 테스트합니다.
 *
 * 주요 검증 사항:
 * - CRUD 메서드가 Repository를 올바르게 호출하는지
 * - 존재하지 않는 Todo에 대해 NotFoundException을 던지는지
 * - 데이터 변환 및 반환이 올바른지
 */

import { createMock, type DeepMocked } from '@golevelup/ts-jest';
import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import type { CreateTodoDto } from './dto/create-todo.dto';
import type { UpdateTodoDto } from './dto/update-todo.dto';
import { TodoRepository } from './todo.repository';
import { TodoService } from './todo.service';

describe('TodoService', () => {
  let service: TodoService;
  let todoRepository: DeepMocked<TodoRepository>;
  let module: TestingModule;

  // Mock Todo 데이터
  const mockTodo = {
    id: 1,
    title: '테스트 할 일',
    content: '테스트 내용',
    completed: false,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  const mockTodos = [
    mockTodo,
    {
      id: 2,
      title: '두 번째 할 일',
      content: null,
      completed: true,
      createdAt: new Date('2024-01-02'),
      updatedAt: new Date('2024-01-02'),
    },
  ];

  beforeEach(async () => {
    todoRepository = createMock<TodoRepository>();

    module = await Test.createTestingModule({
      providers: [TodoService, { provide: TodoRepository, useValue: todoRepository }],
    }).compile();

    service = module.get<TodoService>(TodoService);
  });

  afterEach(async () => {
    await module.close();
    jest.clearAllMocks();
  });

  // ===========================================================================
  // 인스턴스 테스트
  // ===========================================================================

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ===========================================================================
  // findAll() 테스트
  // ===========================================================================

  describe('findAll()', () => {
    it('should return all todos', async () => {
      // Arrange
      todoRepository.findAll.mockResolvedValue(mockTodos);

      // Act
      const result = await service.findAll();

      // Assert
      expect(result).toEqual(mockTodos);
      expect(todoRepository.findAll).toHaveBeenCalledTimes(1);
    });

    it('should return empty array when no todos exist', async () => {
      // Arrange
      todoRepository.findAll.mockResolvedValue([]);

      // Act
      const result = await service.findAll();

      // Assert
      expect(result).toEqual([]);
    });
  });

  // ===========================================================================
  // findById() 테스트
  // ===========================================================================

  describe('findById()', () => {
    it('should return a todo if found', async () => {
      // Arrange
      todoRepository.findById.mockResolvedValue(mockTodo);

      // Act
      const result = await service.findById(1);

      // Assert
      expect(result).toEqual(mockTodo);
      expect(todoRepository.findById).toHaveBeenCalledWith(1);
    });

    it('should throw NotFoundException if todo not found', async () => {
      // Arrange
      todoRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(service.findById(999)).rejects.toThrow(NotFoundException);
      await expect(service.findById(999)).rejects.toThrow('Todo #999 not found');
    });

    it('should call repository with correct id', async () => {
      // Arrange
      const testId = 42;
      todoRepository.findById.mockResolvedValue({ ...mockTodo, id: testId });

      // Act
      await service.findById(testId);

      // Assert
      expect(todoRepository.findById).toHaveBeenCalledWith(testId);
    });
  });

  // ===========================================================================
  // create() 테스트
  // ===========================================================================

  describe('create()', () => {
    it('should create and return a todo', async () => {
      // Arrange
      const createDto: CreateTodoDto = {
        title: '새로운 할 일',
        content: '할 일 내용',
      };
      const createdTodo = {
        id: mockTodo.id,
        title: createDto.title,
        content: createDto.content ?? null,
        completed: mockTodo.completed,
        createdAt: mockTodo.createdAt,
        updatedAt: mockTodo.updatedAt,
      };
      todoRepository.create.mockResolvedValue(createdTodo);

      // Act
      const result = await service.create(createDto);

      // Assert
      expect(result).toEqual(createdTodo);
      expect(todoRepository.create).toHaveBeenCalledWith(createDto);
      expect(todoRepository.create).toHaveBeenCalledTimes(1);
    });

    it('should create a todo without content', async () => {
      // Arrange
      const createDto: CreateTodoDto = {
        title: '내용 없는 할 일',
      };
      const createdTodo = {
        ...mockTodo,
        title: createDto.title,
        content: null,
      };
      todoRepository.create.mockResolvedValue(createdTodo);

      // Act
      const result = await service.create(createDto);

      // Assert
      expect(result.title).toBe(createDto.title);
      expect(result.content).toBeNull();
    });
  });

  // ===========================================================================
  // update() 테스트
  // ===========================================================================

  describe('update()', () => {
    it('should update and return a todo', async () => {
      // Arrange
      const updateDto: UpdateTodoDto = {
        title: '수정된 제목',
        completed: true,
      };
      const updatedTodo = {
        id: mockTodo.id,
        title: updateDto.title ?? mockTodo.title,
        content: mockTodo.content,
        completed: updateDto.completed ?? mockTodo.completed,
        createdAt: mockTodo.createdAt,
        updatedAt: mockTodo.updatedAt,
      };
      todoRepository.findById.mockResolvedValue(mockTodo);
      todoRepository.update.mockResolvedValue(updatedTodo);

      // Act
      const result = await service.update(1, updateDto);

      // Assert
      expect(result).toEqual(updatedTodo);
      expect(todoRepository.findById).toHaveBeenCalledWith(1);
      expect(todoRepository.update).toHaveBeenCalledWith(1, updateDto);
    });

    it('should throw NotFoundException if todo not found', async () => {
      // Arrange
      todoRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(service.update(999, { title: '수정' })).rejects.toThrow(NotFoundException);
      expect(todoRepository.update).not.toHaveBeenCalled();
    });

    it('should verify todo exists before updating', async () => {
      // Arrange
      const callOrder: string[] = [];
      todoRepository.findById.mockImplementation(async () => {
        callOrder.push('findById');
        return mockTodo;
      });
      todoRepository.update.mockImplementation(async () => {
        callOrder.push('update');
        return {
          id: mockTodo.id,
          title: mockTodo.title,
          content: mockTodo.content,
          completed: true,
          createdAt: mockTodo.createdAt,
          updatedAt: mockTodo.updatedAt,
        };
      });

      // Act
      await service.update(1, { completed: true });

      // Assert - findById가 먼저 호출되어야 함
      expect(callOrder).toEqual(['findById', 'update']);
    });

    it('should update only specified fields', async () => {
      // Arrange
      const updateDto: UpdateTodoDto = {
        completed: true,
      };
      todoRepository.findById.mockResolvedValue(mockTodo);
      todoRepository.update.mockResolvedValue({ ...mockTodo, completed: true });

      // Act
      await service.update(1, updateDto);

      // Assert
      expect(todoRepository.update).toHaveBeenCalledWith(1, { completed: true });
    });
  });

  // ===========================================================================
  // delete() 테스트
  // ===========================================================================

  describe('delete()', () => {
    it('should delete and return a todo', async () => {
      // Arrange
      todoRepository.findById.mockResolvedValue(mockTodo);
      todoRepository.delete.mockResolvedValue(mockTodo);

      // Act
      const result = await service.delete(1);

      // Assert
      expect(result).toEqual(mockTodo);
      expect(todoRepository.findById).toHaveBeenCalledWith(1);
      expect(todoRepository.delete).toHaveBeenCalledWith(1);
    });

    it('should throw NotFoundException if todo not found', async () => {
      // Arrange
      todoRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(service.delete(999)).rejects.toThrow(NotFoundException);
      expect(todoRepository.delete).not.toHaveBeenCalled();
    });

    it('should verify todo exists before deleting', async () => {
      // Arrange
      const callOrder: string[] = [];
      todoRepository.findById.mockImplementation(async () => {
        callOrder.push('findById');
        return mockTodo;
      });
      todoRepository.delete.mockImplementation(async () => {
        callOrder.push('delete');
        return mockTodo;
      });

      // Act
      await service.delete(1);

      // Assert - findById가 먼저 호출되어야 함
      expect(callOrder).toEqual(['findById', 'delete']);
    });
  });
});
