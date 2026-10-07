import { createMockDatabaseContext, nativeSqlParameters } from "#test/mocks/database.mock";

import { nativeJobDatabase } from "./prisma8-pg-boss.database.js";

describe("nativeJobDatabase", () => {
  const jobId = "e62aee24-167a-4cc5-91a2-93c171d3f691";
  let tx: ReturnType<typeof createMockDatabaseContext>;

  beforeEach(() => {
    tx = createMockDatabaseContext();
  });

  it("반복되거나 순서가 다른 placeholder에 SQL 문자열 보간 없이 값을 바인딩한다", async () => {
    tx.query.mockResolvedValue([{ id: jobId }]);
    const payload = "quote' $3; DELETE FROM jobs";

    await expect(
      nativeJobDatabase(tx, "id").executeSql(
        "SELECT $2::text, $1::text, $2::text, $3::text, $4::boolean, $5::integer",
        [payload, "queue", null, false, 0],
      ),
    ).resolves.toEqual({ rows: [{ id: jobId }] });

    expect(nativeSqlParameters(tx.query.mock.calls[0]?.[0])).toEqual([
      "queue",
      payload,
      "queue",
      null,
      "false",
      "0",
    ]);
  });

  it("활성 transaction에서 검증된 UUID 배열을 작업 취소에 바인딩한다", async () => {
    tx.query.mockResolvedValue([{ count: 1 }]);

    await expect(
      nativeJobDatabase(tx, "count").executeSql(
        "SELECT count(*) FROM jobs WHERE id = ANY($1::uuid[])",
        [[jobId]],
      ),
    ).resolves.toEqual({ rows: [{ count: 1 }] });
    expect(nativeSqlParameters(tx.query.mock.calls[0]?.[0])).toEqual([`{${jobId}}`]);
  });

  it("취소할 작업이 없는 빈 목록도 처리한다", async () => {
    tx.query.mockResolvedValue([{ count: 0 }]);
    await nativeJobDatabase(tx, "count").executeSql("SELECT $1::uuid[]", [[]]);
    expect(nativeSqlParameters(tx.query.mock.calls[0]?.[0])).toEqual(["{}"]);
  });

  it.each([
    ["missing binding", []],
    ["unsupported object", [{ id: jobId }]],
    ["invalid UUID array", [["not-a-uuid"]]],
  ])("%s 입력은 DB 쿼리를 실행하기 전에 거부한다", async (_name, values) => {
    await expect(
      nativeJobDatabase(tx, "id").executeSql("SELECT $1::text", values),
    ).rejects.toThrow();
    expect(tx.query).not.toHaveBeenCalled();
  });
});
