/**
 * Todo 통합 테스트 (Testcontainers)
 *
 * @description
 * Service와 Repository 계층이 실제 PostgreSQL DB와 함께 올바르게 작동하는지 검증합니다.
 * Testcontainers를 사용하여 독립적인 PostgreSQL 컨테이너에서 테스트합니다.
 *
 * 통합 테스트의 목적:
 * - Service → Repository → Prisma → PostgreSQL 전체 스택 검증
 * - 실제 데이터베이스 쿼리, 제약조건, 트랜잭션 검증
 * - 프로덕션과 동일한 환경에서 테스트
 *
 * 실행 조건:
 * - Docker가 실행 중이어야 함 (Testcontainers 사용)
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test todo.integration-spec
 * ```
 */

import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaService } from '../src/prisma/prisma.service';
import { TodoRepository } from '../src/todo/todo.repository';
import { TodoService } from '../src/todo/todo.service';
import { TestDatabase } from './setup/test-database';

describe('Todo Integration Tests (Real DB)', () => {
  let module: TestingModule;
  let service: TodoService;
  let repository: TodoRepository;
  let testDb: TestDatabase;
  let prisma: PrismaService;

  // 테스트 스위트 시작 시 한 번만 실행
  beforeAll(async () => {
    // TestContainer 시작 및 Prisma 연결
    testDb = new TestDatabase();
    prisma = (await testDb.start()) as PrismaService;

    // NestJS 테스트 모듈 생성
    module = await Test.createTestingModule({
      providers: [
        TodoService,
        TodoRepository,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<TodoService>(TodoService);
    repository = module.get<TodoRepository>(TodoRepository);
  }, 60000); // 컨테이너 시작에 시간이 걸릴 수 있음

  // 각 테스트 전 데이터 초기화
  beforeEach(async () => {
    await testDb.cleanup();
  });

  // 테스트 스위트 종료 시 정리
  afterAll(async () => {
    if (testDb) {
      await testDb.stop();
    }
    if (module) {
      await module.close();
    }
  });

  // ===========================================================================
  // Service와 Repository 연동 테스트
  // ===========================================================================

  describe('Service-Repository Integration', () => {
    it('service should be connected to repository', () => {
      expect(service).toBeDefined();
      expect(repository).toBeDefined();
    });
  });

  // ===========================================================================
  // 전체 CRUD 플로우 테스트
  // ===========================================================================

  describe('Complete CRUD Flow', () => {
    it('should perform full CRUD lifecycle', async () => {
      // 1. Create
      const created = await service.create({
        title: '통합 테스트 할 일',
        content: '통합 테스트 내용',
      });
      expect(created.id).toBeDefined();
      expect(created.title).toBe('통합 테스트 할 일');
      expect(created.completed).toBe(false);

      // 2. Read (findById)
      const found = await service.findById(created.id);
      expect(found.id).toBe(created.id);
      expect(found.title).toBe(created.title);

      // 3. Read (findAll)
      const all = await service.findAll();
      expect(all).toHaveLength(1);
      expect(all[0]?.id).toBe(created.id);

      // 4. Update
      const updated = await service.update(created.id, {
        title: '수정된 제목',
        completed: true,
      });
      expect(updated.title).toBe('수정된 제목');
      expect(updated.completed).toBe(true);

      // 5. Verify update persisted
      const afterUpdate = await service.findById(created.id);
      expect(afterUpdate.title).toBe('수정된 제목');

      // 6. Delete
      const deleted = await service.delete(created.id);
      expect(deleted.id).toBe(created.id);

      // 7. Verify deletion
      await expect(service.findById(created.id)).rejects.toThrow(NotFoundException);

      // 8. Verify empty list
      const finalList = await service.findAll();
      expect(finalList).toHaveLength(0);
    });
  });

  // ===========================================================================
  // 다중 Todo 처리 테스트
  // ===========================================================================

  describe('Multiple Todos Handling', () => {
    it('should handle multiple todos correctly', async () => {
      // 여러 Todo 생성 (약간의 지연을 두어 순서 보장)
      const todo1 = await service.create({ title: '첫 번째' });
      await new Promise((resolve) => setTimeout(resolve, 10));
      const todo2 = await service.create({ title: '두 번째' });
      await new Promise((resolve) => setTimeout(resolve, 10));
      const todo3 = await service.create({ title: '세 번째' });

      // 전체 조회
      const all = await service.findAll();
      expect(all).toHaveLength(3);

      // 최신 항목이 먼저 오는지 확인 (createdAt desc)
      const titles = all.map((t) => t.title);
      expect(titles).toContain('첫 번째');
      expect(titles).toContain('두 번째');
      expect(titles).toContain('세 번째');

      // ID가 큰 순서로 정렬되어 있는지 확인 (최신이 먼저)
      expect(all).toHaveLength(3);
      expect((all[0] as { id: number }).id).toBeGreaterThan((all[1] as { id: number }).id);
      expect((all[1] as { id: number }).id).toBeGreaterThan((all[2] as { id: number }).id);

      // 특정 항목만 삭제
      await service.delete(todo2.id);
      const afterDelete = await service.findAll();
      expect(afterDelete).toHaveLength(2);

      // 삭제된 항목이 없는지 확인
      const ids = afterDelete.map((t) => t.id);
      expect(ids).not.toContain(todo2.id);
      expect(ids).toContain(todo1.id);
      expect(ids).toContain(todo3.id);
    });

    it('should update only the targeted todo', async () => {
      // 여러 Todo 생성
      const todo1 = await service.create({ title: 'Todo 1' });
      const todo2 = await service.create({ title: 'Todo 2' });

      // todo1만 업데이트
      await service.update(todo1.id, { completed: true });

      // todo1은 변경되고, todo2는 그대로인지 확인
      const updated1 = await service.findById(todo1.id);
      const unchanged2 = await service.findById(todo2.id);

      expect(updated1.completed).toBe(true);
      expect(unchanged2.completed).toBe(false);
    });
  });

  // ===========================================================================
  // 에러 처리 통합 테스트
  // ===========================================================================

  describe('Error Handling Integration', () => {
    it('should throw NotFoundException for non-existent todo on findById', async () => {
      await expect(service.findById(99999)).rejects.toThrow(NotFoundException);
      await expect(service.findById(99999)).rejects.toThrow('Todo #99999 not found');
    });

    it('should throw NotFoundException for non-existent todo on update', async () => {
      await expect(service.update(99999, { title: '수정 시도' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException for non-existent todo on delete', async () => {
      await expect(service.delete(99999)).rejects.toThrow(NotFoundException);
    });

    it('should not affect other todos when operation fails', async () => {
      // 정상 Todo 생성
      const validTodo = await service.create({ title: '정상 Todo' });

      // 존재하지 않는 Todo 업데이트 시도
      await expect(service.update(99999, { title: '실패' })).rejects.toThrow();

      // 기존 Todo는 영향받지 않음
      const unchanged = await service.findById(validTodo.id);
      expect(unchanged.title).toBe('정상 Todo');
    });
  });

  // ===========================================================================
  // 데이터 무결성 테스트
  // ===========================================================================

  describe('Data Integrity', () => {
    it('should maintain data consistency across operations', async () => {
      // 생성
      const original = await service.create({
        title: '원본 제목',
        content: '원본 내용',
      });

      // 부분 업데이트 (title만)
      await service.update(original.id, { title: '수정된 제목' });

      // content는 유지되어야 함
      const afterTitleUpdate = await service.findById(original.id);
      expect(afterTitleUpdate.title).toBe('수정된 제목');
      expect(afterTitleUpdate.content).toBe('원본 내용');

      // 부분 업데이트 (completed만)
      await service.update(original.id, { completed: true });

      // 이전 변경사항이 유지되어야 함
      const afterCompletedUpdate = await service.findById(original.id);
      expect(afterCompletedUpdate.title).toBe('수정된 제목');
      expect(afterCompletedUpdate.content).toBe('원본 내용');
      expect(afterCompletedUpdate.completed).toBe(true);
    });

    it('should set correct default values on create', async () => {
      const todo = await service.create({
        title: '기본값 테스트',
      });

      expect(todo.completed).toBe(false);
      expect(todo.content).toBeNull();
      expect(todo.createdAt).toBeInstanceOf(Date);
      expect(todo.updatedAt).toBeInstanceOf(Date);
    });

    it('should update updatedAt timestamp on update', async () => {
      const original = await service.create({ title: '타임스탬프 테스트' });
      const originalUpdatedAt = original.updatedAt;

      // 약간의 지연 후 업데이트
      await new Promise((resolve) => setTimeout(resolve, 100));
      const updated = await service.update(original.id, { title: '수정됨' });

      expect(updated.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });
  });

  // ===========================================================================
  // 경계값 테스트
  // ===========================================================================

  describe('Boundary Conditions', () => {
    it('should handle empty database correctly', async () => {
      const all = await service.findAll();
      expect(all).toEqual([]);
    });

    it('should handle todo with null content', async () => {
      const todo = await service.create({
        title: '내용 없음',
      });

      expect(todo.content).toBeNull();

      const found = await service.findById(todo.id);
      expect(found.content).toBeNull();
    });

    it('should handle todo with empty string content', async () => {
      const todo = await service.create({
        title: '빈 내용',
        content: '',
      });

      // 빈 문자열이 저장되어야 함
      expect(todo.content).toBe('');
    });
  });

  // ===========================================================================
  // 데이터베이스 제약조건 테스트 (실제 DB에서만 가능)
  // ===========================================================================

  describe('Database Constraints', () => {
    it('should auto-increment id for new todos', async () => {
      const todo1 = await service.create({ title: 'First' });
      const todo2 = await service.create({ title: 'Second' });

      expect(todo2.id).toBeGreaterThan(todo1.id);
    });

    it('should set timestamps automatically', async () => {
      const before = new Date();
      const todo = await service.create({ title: 'Timestamp Test' });
      const after = new Date();

      expect(todo.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(todo.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
      expect(todo.updatedAt.getTime()).toBe(todo.createdAt.getTime());
    });
  });
});
