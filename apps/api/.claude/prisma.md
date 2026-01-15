# Prisma 7 가이드

## 개요

이 프로젝트는 **Prisma 7.2.0**을 사용합니다. Prisma 7은 Rust에서 TypeScript로 재작성되어 90% 작은 번들, 3배 빠른 쿼리 성능을 제공합니다.

## 프로젝트 설정

### 스키마 위치
- `prisma/schema.prisma`

### 생성된 클라이언트 위치
- `src/generated/prisma/` (Prisma 7에서 `output` 필수)

### Driver Adapter
```typescript
// src/database/database.service.ts
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });
```

## Prisma 7 핵심 변경사항

### 1. Generator 설정 (필수)

```prisma
generator client {
  provider     = "prisma-client"      // ❌ prisma-client-js 아님
  output       = "../src/generated/prisma"  // ✅ 필수
  moduleFormat = "cjs"                // CommonJS (NestJS 호환)
}
```

### 2. Driver Adapter 필수

모든 DB 연결에 드라이버 어댑터가 필요합니다.

```typescript
// PostgreSQL
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString });
new PrismaClient({ adapter });
```

### 3. ESM 지원

- `package.json`에 `"type": "module"` 또는
- `moduleFormat = "cjs"` 설정 (NestJS 권장)

## 자주 사용하는 명령어

| 명령어 | 설명 |
|--------|------|
| `pnpm db:generate` | 클라이언트 생성 |
| `pnpm db:migrate` | 마이그레이션 실행 |
| `pnpm db:push` | 스키마 즉시 반영 (개발용) |
| `pnpm --filter @aido/api prisma:studio` | Prisma Studio |

## 쿼리 작성 가이드

### Repository 패턴

```typescript
@Injectable()
export class TodoRepository {
  constructor(private readonly db: DatabaseService) {}

  async findById(id: string) {
    return this.db.todo.findUnique({ where: { id } });
  }

  async findByUserId(userId: string) {
    return this.db.todo.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
```

### 관계 조회 (Include)

```typescript
// DO: 필요한 관계만 명시
const user = await this.db.user.findUnique({
  where: { id },
  include: {
    profile: true,
    todos: { take: 10, orderBy: { createdAt: 'desc' } },
  },
});

// DON'T: 과도한 중첩 include (N+1 위험)
```

### Select로 필드 제한

```typescript
// 필요한 필드만 조회 (성능 최적화)
const users = await this.db.user.findMany({
  select: {
    id: true,
    email: true,
    profile: { select: { name: true } },
  },
});
```

## 트랜잭션

### Interactive Transaction (권장)

```typescript
await this.db.$transaction(async (tx) => {
  const user = await tx.user.create({ data: userData });
  await tx.userProfile.create({
    data: { userId: user.id, ...profileData },
  });
  return user;
});
```

### Sequential Transaction

```typescript
// 여러 쿼리를 원자적으로 실행
await this.db.$transaction([
  this.db.todo.deleteMany({ where: { userId } }),
  this.db.user.delete({ where: { id: userId } }),
]);
```

## 성능 최적화

### 1. 인덱스 활용

```prisma
model Todo {
  // 복합 인덱스: 자주 함께 조회되는 필드
  @@index([userId, startDate, endDate])
  @@index([userId, completed, startDate])
}
```

### 2. 페이지네이션

```typescript
// 오프셋 기반 (간단하지만 대량 데이터에 느림)
const todos = await this.db.todo.findMany({
  skip: (page - 1) * size,
  take: size,
});

// 커서 기반 (권장 - 대량 데이터에 효율적)
const todos = await this.db.todo.findMany({
  take: size,
  cursor: cursor ? { id: cursor } : undefined,
  skip: cursor ? 1 : 0,
});
```

### 3. 배치 처리

```typescript
// 대량 생성
await this.db.todo.createMany({
  data: todosData,
  skipDuplicates: true,
});

// 대량 업데이트
await this.db.todo.updateMany({
  where: { userId, completed: false },
  data: { completed: true },
});
```

## 주의사항

### 1. N+1 문제 방지

```typescript
// ❌ BAD: 루프 내 쿼리
for (const user of users) {
  const todos = await this.db.todo.findMany({ where: { userId: user.id } });
}

// ✅ GOOD: Include 또는 별도 쿼리
const users = await this.db.user.findMany({
  include: { todos: true },
});

// 또는
const userIds = users.map(u => u.id);
const todos = await this.db.todo.findMany({
  where: { userId: { in: userIds } },
});
```

### 2. Soft Delete 처리

```typescript
// 삭제 시
await this.db.user.update({
  where: { id },
  data: { deletedAt: new Date() },
});

// 조회 시 항상 필터
const users = await this.db.user.findMany({
  where: { deletedAt: null },
});
```

### 3. 연결 풀 관리

Prisma 7은 드라이버별 기본 연결 풀 설정이 다릅니다. 타임아웃 발생 시:

```typescript
const adapter = new PrismaPg({
  connectionString,
  // 필요시 풀 설정 조정
});
```

### 4. 환경변수 로드

Prisma 7은 `.env` 자동 로드가 제거되었습니다. NestJS의 `ConfigService` 사용을 권장합니다.

```typescript
// ✅ ConfigService로 환경변수 주입
constructor(configService: ConfigService) {
  const connectionString = configService.get('DATABASE_URL');
}
```

## 마이그레이션 워크플로우

### 개발 환경

```bash
# 1. 스키마 수정 후
# 2. 마이그레이션 생성 + 적용
pnpm db:migrate

# 또는 빠른 반영 (마이그레이션 파일 없이)
pnpm db:push
```

### 프로덕션 환경

```bash
# 마이그레이션만 적용 (생성 안 함)
prisma migrate deploy
```

## 테스트 환경 (Testcontainers)

```typescript
// test/setup/test-database.ts
export class TestDatabase {
  async start() {
    // PostgreSQL 컨테이너 시작
    // 마이그레이션 적용
  }

  getPrisma() {
    // 테스트용 PrismaClient 반환
  }

  async cleanup() {
    // 테스트 데이터 정리
  }
}
```

## 참고 자료

- [Prisma 7 릴리즈 공지](https://www.prisma.io/blog/announcing-prisma-orm-7-0-0)
- [Prisma 7 업그레이드 가이드](https://www.prisma.io/docs/orm/more/upgrade-guides/upgrading-versions/upgrading-to-prisma-7)
- [Prisma 7.2.0 변경사항](https://www.prisma.io/blog/announcing-prisma-orm-7-2-0)
