import type { IdGenerator } from '@src/core/ports/id-generator';

/** 호출마다 다른 id를 준다. 멱등 키가 다시 쓰였는지 값으로 비교할 수 있다 */
export function createIdGeneratorStub(): jest.Mocked<IdGenerator> {
  let count = 0;
  return {
    create: jest.fn(() => {
      count += 1;
      return `test-id-${count}`;
    }),
  };
}
