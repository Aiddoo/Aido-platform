import { createFakeDatabase, queryResult } from "#test/mocks/drizzle.mock";

import { transactionJobDatabase } from "./drizzle-pg-boss.database.js";

describe("transactionJobDatabase", () => {
  const jobId = "e62aee24-167a-4cc5-91a2-93c171d3f691";

  it("반복되거나 순서가 다른 placeholder를 SQL 문자열 보간 없이 바인딩한다", async () => {
    // Given
    const { database, statements } = createFakeDatabase(async () => queryResult([{ id: jobId }]));
    const payload = "quote' $3; DELETE FROM jobs";

    // When
    const result = await transactionJobDatabase(database).executeSql(
      "SELECT $2::text, $1::text, $2::text, $3::text, $4::boolean, $5::integer",
      [payload, "queue", null, false, 0],
    );

    // Then
    expect(result.rows).toEqual([{ id: jobId }]);
    expect(statements).toEqual([
      {
        text: "SELECT $1::text, $2::text, $3::text, $4::text, $5::boolean, $6::integer",
        params: ["queue", payload, "queue", null, false, 0],
      },
    ]);
  });

  it("작업 취소의 UUID 배열은 PostgreSQL 배열 파라미터 하나로 바인딩한다", async () => {
    // Given
    const { database, statements } = createFakeDatabase();

    // When
    await transactionJobDatabase(database).executeSql(
      "SELECT count(*) FROM jobs WHERE id = ANY($1::uuid[])",
      [[jobId]],
    );

    // Then
    expect(statements[0]?.params).toEqual([[jobId]]);
  });

  it.each([
    ["missing binding", []],
    ["unsupported object", [{ id: jobId }]],
  ])("%s 입력은 쿼리를 실행하기 전에 거부한다", async (_name, values) => {
    // Given
    const { database, statements } = createFakeDatabase();

    // When / Then
    await expect(
      transactionJobDatabase(database).executeSql("SELECT $1::text", values),
    ).rejects.toThrow(TypeError);
    expect(statements).toHaveLength(0);
  });
});
