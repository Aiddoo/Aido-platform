/**
 * Todo API E2E 테스트
 *
 * @description
 * Todo CRUD API의 전체 흐름을 실제 HTTP 요청으로 검증합니다.
 * 실제 데이터베이스 연결이 필요하며, 테스트 데이터를 생성/삭제합니다.
 *
 * 테스트 전략:
 * - 실제 HTTP 요청을 통한 API 검증 (supertest)
 * - 각 테스트 케이스는 독립적으로 실행 가능해야 함
 * - 생성된 테스트 데이터는 테스트 종료 시 정리
 *
 * 실행 조건:
 * - PostgreSQL 데이터베이스가 실행 중이어야 함
 * - DATABASE_URL 환경변수가 설정되어 있어야 함
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test:e2e
 * ```
 */

import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { ZodValidationPipe } from 'nestjs-zod';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('TodoController (e2e)', () => {
  let app: INestApplication<App>;
  let createdTodoId: number;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ZodValidationPipe());
    await app.init();
  });

  afterAll(async () => {
    // 테스트에서 생성된 데이터 정리
    if (createdTodoId) {
      try {
        await request(app.getHttpServer()).delete(`/todos/${createdTodoId}`);
      } catch {
        // 이미 삭제되었거나 존재하지 않는 경우 무시
      }
    }
    await app.close();
  });

  // ===========================================================================
  // POST /todos - Todo 생성
  // ===========================================================================

  describe('POST /todos', () => {
    it('should create a new todo with title and content', async () => {
      const createDto = {
        title: 'E2E Test Todo',
        content: 'This is an E2E test content',
      };

      const response = await request(app.getHttpServer())
        .post('/todos')
        .send(createDto)
        .expect(201);

      expect(response.body).toMatchObject({
        title: createDto.title,
        content: createDto.content,
        completed: false,
      });
      expect(response.body.id).toBeDefined();
      expect(response.body.createdAt).toBeDefined();
      expect(response.body.updatedAt).toBeDefined();

      // 후속 테스트를 위해 ID 저장
      createdTodoId = response.body.id;
    });

    it('should create a todo with title only', async () => {
      const createDto = { title: 'Title Only E2E Todo' };

      const response = await request(app.getHttpServer())
        .post('/todos')
        .send(createDto)
        .expect(201);

      expect(response.body.title).toBe(createDto.title);
      expect(response.body.content).toBeNull();
      expect(response.body.completed).toBe(false);

      // 정리: 생성된 추가 todo 삭제
      await request(app.getHttpServer()).delete(`/todos/${response.body.id}`);
    });

    it('should return 400 for empty title', async () => {
      const invalidDto = { title: '' };

      await request(app.getHttpServer()).post('/todos').send(invalidDto).expect(400);
    });

    it('should return 400 for missing title', async () => {
      const invalidDto = { content: 'Content without title' };

      await request(app.getHttpServer()).post('/todos').send(invalidDto).expect(400);
    });

    it('should return 400 for title exceeding max length', async () => {
      const invalidDto = { title: 'a'.repeat(101) }; // 100자 초과

      await request(app.getHttpServer()).post('/todos').send(invalidDto).expect(400);
    });
  });

  // ===========================================================================
  // GET /todos - 모든 Todo 조회
  // ===========================================================================

  describe('GET /todos', () => {
    it('should return array of todos', async () => {
      const response = await request(app.getHttpServer()).get('/todos').expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should include the created todo in the list', async () => {
      const response = await request(app.getHttpServer()).get('/todos').expect(200);

      const foundTodo = response.body.find((todo: { id: number }) => todo.id === createdTodoId);
      expect(foundTodo).toBeDefined();
      expect(foundTodo.title).toBe('E2E Test Todo');
    });
  });

  // ===========================================================================
  // GET /todos/:id - Todo 상세 조회
  // ===========================================================================

  describe('GET /todos/:id', () => {
    it('should return a todo by id', async () => {
      const response = await request(app.getHttpServer())
        .get(`/todos/${createdTodoId}`)
        .expect(200);

      expect(response.body.id).toBe(createdTodoId);
      expect(response.body.title).toBe('E2E Test Todo');
      expect(response.body.content).toBe('This is an E2E test content');
    });

    it('should return 404 for non-existent id', async () => {
      await request(app.getHttpServer()).get('/todos/999999').expect(404);
    });

    it('should return 400 for invalid id format', async () => {
      await request(app.getHttpServer()).get('/todos/invalid').expect(400);
    });
  });

  // ===========================================================================
  // PUT /todos/:id - Todo 수정
  // ===========================================================================

  describe('PUT /todos/:id', () => {
    it('should update todo title', async () => {
      const updateDto = { title: 'Updated E2E Title' };

      const response = await request(app.getHttpServer())
        .put(`/todos/${createdTodoId}`)
        .send(updateDto)
        .expect(200);

      expect(response.body.id).toBe(createdTodoId);
      expect(response.body.title).toBe('Updated E2E Title');
      expect(response.body.content).toBe('This is an E2E test content'); // 변경되지 않음
    });

    it('should update todo completed status', async () => {
      const updateDto = { completed: true };

      const response = await request(app.getHttpServer())
        .put(`/todos/${createdTodoId}`)
        .send(updateDto)
        .expect(200);

      expect(response.body.completed).toBe(true);
    });

    it('should update multiple fields at once', async () => {
      const updateDto = {
        title: 'Final Updated Title',
        content: 'Final Updated Content',
        completed: false,
      };

      const response = await request(app.getHttpServer())
        .put(`/todos/${createdTodoId}`)
        .send(updateDto)
        .expect(200);

      expect(response.body.title).toBe('Final Updated Title');
      expect(response.body.content).toBe('Final Updated Content');
      expect(response.body.completed).toBe(false);
    });

    it('should return 404 for non-existent id', async () => {
      const updateDto = { title: 'Should Not Update' };

      await request(app.getHttpServer()).put('/todos/999999').send(updateDto).expect(404);
    });

    it('should return 400 for invalid update data', async () => {
      const invalidDto = { title: '' };

      await request(app.getHttpServer())
        .put(`/todos/${createdTodoId}`)
        .send(invalidDto)
        .expect(400);
    });
  });

  // ===========================================================================
  // DELETE /todos/:id - Todo 삭제
  // ===========================================================================

  describe('DELETE /todos/:id', () => {
    it('should return 404 for non-existent id', async () => {
      await request(app.getHttpServer()).delete('/todos/999999').expect(404);
    });

    it('should delete the todo and return deleted data', async () => {
      // 삭제용 todo 생성
      const createResponse = await request(app.getHttpServer())
        .post('/todos')
        .send({ title: 'Todo to Delete' })
        .expect(201);

      const todoIdToDelete = createResponse.body.id;

      // 삭제 수행
      const deleteResponse = await request(app.getHttpServer())
        .delete(`/todos/${todoIdToDelete}`)
        .expect(200);

      expect(deleteResponse.body.id).toBe(todoIdToDelete);
      expect(deleteResponse.body.title).toBe('Todo to Delete');

      // 삭제 확인
      await request(app.getHttpServer()).get(`/todos/${todoIdToDelete}`).expect(404);
    });
  });

  // ===========================================================================
  // 통합 CRUD 시나리오
  // ===========================================================================

  describe('Full CRUD Flow', () => {
    it('should complete full CRUD cycle', async () => {
      // 1. Create
      const createResponse = await request(app.getHttpServer())
        .post('/todos')
        .send({ title: 'CRUD Flow Todo', content: 'Initial content' })
        .expect(201);

      const todoId = createResponse.body.id;
      expect(todoId).toBeDefined();

      // 2. Read
      const readResponse = await request(app.getHttpServer()).get(`/todos/${todoId}`).expect(200);

      expect(readResponse.body.title).toBe('CRUD Flow Todo');

      // 3. Update
      const updateResponse = await request(app.getHttpServer())
        .put(`/todos/${todoId}`)
        .send({ title: 'Updated CRUD Todo', completed: true })
        .expect(200);

      expect(updateResponse.body.title).toBe('Updated CRUD Todo');
      expect(updateResponse.body.completed).toBe(true);

      // 4. Delete
      const deleteResponse = await request(app.getHttpServer())
        .delete(`/todos/${todoId}`)
        .expect(200);

      expect(deleteResponse.body.id).toBe(todoId);

      // 5. Verify deletion
      await request(app.getHttpServer()).get(`/todos/${todoId}`).expect(404);
    });
  });
});
