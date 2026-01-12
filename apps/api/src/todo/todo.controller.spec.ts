/**
 * TodoController 단위 테스트
 *
 * @description
 * Controller의 HTTP 핸들링 로직을 검증합니다.
 * TodoService를 모킹하여 Controller만 격리 테스트합니다.
 *
 * 사용 라이브러리:
 * - @nestjs/testing: NestJS 공식 테스팅 모듈
 * - @golevelup/ts-jest: createMock으로 깊은 중첩 객체 자동 모킹
 *
 * 테스트 패턴:
 * - AAA 패턴 (Arrange-Act-Assert)
 * - .overrideProvider()로 DI 컨테이너에서 프로바이더 교체
 */

import { createMock, type DeepMocked } from '@golevelup/ts-jest';
import { Test, type TestingModule } from '@nestjs/testing';
import type { CreateTodoDto } from './dto/create-todo.dto';
import type { UpdateTodoDto } from './dto/update-todo.dto';
import { TodoController } from './todo.controller';
import { TodoService } from './todo.service';

describe('TodoController', () => {
  let controller: TodoController;
  let todoService: DeepMocked<TodoService>;
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
    // createMock으로 TodoService의 모든 메서드를 jest.fn()으로 변환
    todoService = createMock<TodoService>();

    module = await Test.createTestingModule({
      controllers: [TodoController],
      providers: [TodoService],
    })
      // 실제 TodoService 대신 모킹된 서비스 주입
      .overrideProvider(TodoService)
      .useValue(todoService)
      .compile();

    controller = module.get<TodoController>(TodoController);
  });

  afterEach(async () => {
    await module.close();
    // 모든 mock 초기화 (테스트 간 격리)
    jest.clearAllMocks();
  });

  // ===========================================================================
  // 인스턴스 테스트
  // ===========================================================================

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ===========================================================================
  // findAll() 테스트
  // ===========================================================================

  describe('findAll()', () => {
    it('should return an array of todos', async () => {
      // Arrange
      todoService.findAll.mockResolvedValue(mockTodos);

      // Act
      const result = await controller.findAll();

      // Assert
      expect(result).toEqual(mockTodos);
      expect(todoService.findAll).toHaveBeenCalledTimes(1);
    });

    it('should return empty array when no todos exist', async () => {
      // Arrange
      todoService.findAll.mockResolvedValue([]);

      // Act
      const result = await controller.findAll();

      // Assert
      expect(result).toEqual([]);
      expect(todoService.findAll).toHaveBeenCalledTimes(1);
    });
  });

  // ===========================================================================
  // findById() 테스트
  // ===========================================================================

  describe('findById()', () => {
    it('should return a todo by id', async () => {
      // Arrange
      todoService.findById.mockResolvedValue(mockTodo);

      // Act
      const result = await controller.findById(1);

      // Assert
      expect(result).toEqual(mockTodo);
      expect(todoService.findById).toHaveBeenCalledWith(1);
      expect(todoService.findById).toHaveBeenCalledTimes(1);
    });

    it('should call service with correct id parameter', async () => {
      // Arrange
      const testId = 42;
      todoService.findById.mockResolvedValue({ ...mockTodo, id: testId });

      // Act
      await controller.findById(testId);

      // Assert
      expect(todoService.findById).toHaveBeenCalledWith(testId);
    });
  });

  // ===========================================================================
  // create() 테스트
  // ===========================================================================

  describe('create()', () => {
    it('should create a new todo', async () => {
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
      todoService.create.mockResolvedValue(createdTodo);

      // Act
      const result = await controller.create(createDto);

      // Assert
      expect(result).toEqual(createdTodo);
      expect(todoService.create).toHaveBeenCalledWith(createDto);
      expect(todoService.create).toHaveBeenCalledTimes(1);
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
      todoService.create.mockResolvedValue(createdTodo);

      // Act
      const result = await controller.create(createDto);

      // Assert
      expect(result.title).toBe(createDto.title);
      expect(result.content).toBeNull();
      expect(todoService.create).toHaveBeenCalledWith(createDto);
    });
  });

  // ===========================================================================
  // update() 테스트
  // ===========================================================================

  describe('update()', () => {
    it('should update a todo', async () => {
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
      todoService.update.mockResolvedValue(updatedTodo);

      // Act
      const result = await controller.update(1, updateDto);

      // Assert
      expect(result).toEqual(updatedTodo);
      expect(todoService.update).toHaveBeenCalledWith(1, updateDto);
      expect(todoService.update).toHaveBeenCalledTimes(1);
    });

    it('should update only completed status', async () => {
      // Arrange
      const updateDto: UpdateTodoDto = {
        completed: true,
      };
      const updatedTodo = {
        ...mockTodo,
        completed: true,
      };
      todoService.update.mockResolvedValue(updatedTodo);

      // Act
      const result = await controller.update(1, updateDto);

      // Assert
      expect(result.completed).toBe(true);
      expect(todoService.update).toHaveBeenCalledWith(1, updateDto);
    });

    it('should call service with correct id and dto', async () => {
      // Arrange
      const testId = 99;
      const updateDto: UpdateTodoDto = {
        title: '테스트',
        content: '내용',
        completed: false,
      };
      todoService.update.mockResolvedValue({
        ...mockTodo,
        ...updateDto,
        id: testId,
      });

      // Act
      await controller.update(testId, updateDto);

      // Assert
      expect(todoService.update).toHaveBeenCalledWith(testId, updateDto);
    });
  });

  // ===========================================================================
  // delete() 테스트
  // ===========================================================================

  describe('delete()', () => {
    it('should delete a todo', async () => {
      // Arrange
      todoService.delete.mockResolvedValue(mockTodo);

      // Act
      const result = await controller.delete(1);

      // Assert
      expect(result).toEqual(mockTodo);
      expect(todoService.delete).toHaveBeenCalledWith(1);
      expect(todoService.delete).toHaveBeenCalledTimes(1);
    });

    it('should call service with correct id', async () => {
      // Arrange
      const testId = 123;
      todoService.delete.mockResolvedValue({ ...mockTodo, id: testId });

      // Act
      await controller.delete(testId);

      // Assert
      expect(todoService.delete).toHaveBeenCalledWith(testId);
    });
  });
});
