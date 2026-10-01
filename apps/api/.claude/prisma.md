# Prisma 7 가이드

**Version**: 1.1.0 · **Last Updated**: 2026-10-01 · **Owner**: Aido Platform Team

> Prisma 7.10 사용법 및 쿼리 패턴 가이드

## 관련 문서

| 문서                                         | 설명                               |
| -------------------------------------------- | ---------------------------------- |
| [architecture.md](./architecture.md)         | 전체 아키텍처 개요                 |
| [api-conventions.md](./api-conventions.md)   | Controller/Service/Repository 규칙 |
| [integration-test.md](./integration-test.md) | Testcontainers 통합 테스트         |

---

## 개요

| 항목            | 값                                |
| --------------- | --------------------------------- |
| 버전            | Prisma 7.10.0                     |
| 스키마 위치     | `prisma/schema.prisma`            |
| 생성 클라이언트 | `src/generated/prisma/`           |
| 어댑터          | `@prisma/adapter-pg` (PostgreSQL) |

생성 클라이언트는 ESM이고 PostgreSQL 연결은 `@prisma/adapter-pg`가 소유한다. 버전 갱신만으로 성능 개선을 주장하지 않고 동일한 시나리오로 측정한다.

`prisma` CLI는 클라이언트 생성과 migration에 쓰는 직접 개발 의존성이다. API 실행에는 생성 클라이언트, `@prisma/client` runtime, PostgreSQL adapter와 CLS transaction adapter를 사용한다. Migration workspace는 CLI를 직접 의존하며 API production 이미지와 분리한다. CLI/client 버전은 catalog에서 함께 유지한다.

---

## Prisma 7 핵심 변경사항

### Generator 설정 (필수)

```prisma
generator client {
  provider     = "prisma-client"            // ❌ prisma-client-js 아님
  output       = "../src/generated/prisma"  // ✅ 필수
  moduleFormat = "esm"                      // NodeNext ESM
}
```

### Driver Adapter (필수)

모든 DB 연결에 드라이버 어댑터가 필요합니다.

```typescript
// src/shared/infrastructure/database/database.service.ts
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });
```

### ESM 지원

API package의 `"type": "module"`, TypeScript의 NodeNext 설정, generator의 `moduleFormat = "esm"`을 함께 유지한다.

---

## 주요 명령어

| 명령어                                  | 설명                      |
| --------------------------------------- | ------------------------- |
| `pnpm db:generate`                      | 클라이언트 생성           |
| `pnpm db:migrate`                       | 마이그레이션 실행         |
| `pnpm db:push`                          | 스키마 즉시 반영 (개발용) |
| `pnpm --filter @aido/api prisma:studio` | Prisma Studio 실행        |

---

## Repository 패턴

### 기본 구조

리포지토리는 `TransactionHost`의 `tx`를 읽는다. 활성 CLS 트랜잭션이 있으면 참여하고, 없으면 기본 클라이언트를 사용한다. application/domain 계층에는 Prisma client나 `tx` 파라미터를 전달하지 않는다.

```typescript
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Injectable } from '@nestjs/common';

import type { DatabaseService } from '#api/shared/infrastructure/database/database.service';

@Injectable()
export class TodoRowRepository {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma<DatabaseService>>,
  ) {}

  private get client() {
    return this.txHost.tx;
  }

  async findByIdAndUserId(id: number, userId: string) {
    return this.client.todo.findFirst({ where: { id, userId } });
  }
}
```

### 관계 조회 (Include)

```typescript
// ✅ 필요한 관계만 명시
const user = await this.client.user.findUnique({
  where: { id },
  include: {
    profile: true,
    todos: { take: 10, orderBy: { createdAt: 'desc' } },
  },
});
```

### 필드 선택 (Select)

```typescript
// ✅ 필요한 필드만 조회 (성능 최적화)
const users = await this.client.user.findMany({
  select: {
    id: true,
    email: true,
    profile: { select: { name: true } },
  },
});
```

---

## 트랜잭션

### UnitOfWorkPort와 CLS

쓰기 use-case는 `UNIT_OF_WORK`로 주입한 `UnitOfWorkPort`의 `run`에서 트랜잭션 경계를 선언한다. 콜백은 `tx`를 받지 않으며 모든 리포지토리는 동일한 CLS context에 참여한다. 중첩 `run`은 Required propagation으로 기존 트랜잭션을 재사용한다.

```typescript
const created = await this.uow.run(async () => {
  const maxSortOrder = await this.todoRepository.getMaxSortOrder(userId);
  return this.todoRepository.create({ ...draft, sortOrder: maxSortOrder + 1 });
});
```

상세 구현은 `src/todo/application/use-cases/create-todo/create-todo.use-case.ts`와 `src/shared/application/ports/unit-of-work.port.ts`를 기준으로 한다. use-case에서 직접 `$transaction`을 호출하거나 Prisma의 `TransactionClient`를 계층 간에 전달하지 않는다. 캐시 무효화와 도메인 이벤트 발행은 commit 뒤에 수행한다.

---

## 성능 최적화

### 인덱스 설계

```prisma
model Todo {
  // 복합 인덱스: 자주 함께 조회되는 필드
  @@index([userId, startDate, endDate])
  @@index([userId, completed, startDate])
}
```

### 페이지네이션

```typescript
// 오프셋 기반 (간단하지만 대량 데이터에 느림)
const todos = await this.client.todo.findMany({
  skip: (page - 1) * size,
  take: size,
});

// 커서 기반 (권장 - 대량 데이터에 효율적)
const todos = await this.client.todo.findMany({
  take: size,
  cursor: cursor ? { id: cursor } : undefined,
  skip: cursor ? 1 : 0,
});
```

### 배치 처리

```typescript
// 대량 생성
await this.client.todo.createMany({
  data: todosData,
  skipDuplicates: true,
});

// 대량 업데이트
await this.client.todo.updateMany({
  where: { userId, completed: false },
  data: { completed: true },
});
```

---

## 주의사항

### N+1 문제 방지

```typescript
// ❌ 루프 내 쿼리
for (const user of users) {
  const todos = await this.client.todo.findMany({ where: { userId: user.id } });
}

// ✅ Include 사용
const users = await this.client.user.findMany({
  include: { todos: true },
});

// ✅ 또는 별도 쿼리로 일괄 조회
const userIds = users.map((u) => u.id);
const todos = await this.client.todo.findMany({
  where: { userId: { in: userIds } },
});
```

### Soft Delete 처리

```typescript
// 삭제 시
await this.client.user.update({
  where: { id },
  data: { deletedAt: new Date() },
});

// 조회 시 항상 필터
const users = await this.client.user.findMany({
  where: { deletedAt: null },
});
```

### 환경변수 로드

Prisma 7은 `.env` 자동 로드가 제거되었습니다.

```typescript
// ✅ ConfigService 사용
constructor(configService: ConfigService) {
  const connectionString = configService.get('DATABASE_URL');
}
```

---

## 마이그레이션 워크플로우

### 개발 환경

```bash
# 스키마 수정 후 마이그레이션 생성 + 적용
pnpm db:migrate

# 빠른 반영 (마이그레이션 파일 없이)
pnpm db:push
```

### 프로덕션 환경

```bash
# 마이그레이션만 적용 (생성 안 함)
prisma migrate deploy
```

---

## 테스트 환경

Testcontainers로 격리된 PostgreSQL 컨테이너를 사용합니다.

```typescript
// test/setup/test-database.ts
export class TestDatabase {
  async start() {
    // global setup이 준비한 관리형 DB에 연결
  }

  getPrisma() {
    // 테스트용 PrismaClient 반환
  }

  async cleanup() {
    // 테스트 데이터 정리
  }
}
```

자세한 내용은 [integration-test.md](./integration-test.md) 참고.

---

## 참고 자료

- [Prisma 7 릴리즈 공지](https://www.prisma.io/blog/announcing-prisma-orm-7-0-0)
- [Prisma 7 업그레이드 가이드](https://www.prisma.io/docs/orm/more/upgrade-guides/upgrading-versions/upgrading-to-prisma-7)
- [Prisma 7.10.0 변경사항](https://www.prisma.io/docs/orm/overview/releases)

---

**문서 버전**: 3.1.0
**최종 수정일**: 2026-10-01
