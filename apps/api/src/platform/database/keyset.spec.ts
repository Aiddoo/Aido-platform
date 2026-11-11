import { boolean, integer, pgTable, serial } from "drizzle-orm/pg-core";

import { renderSql } from "#test/mocks/drizzle.mock";

import { instant } from "./columns/temporal-columns.js";
import { tupleGreaterThan, tupleLessThan } from "./keyset.js";

const sample = pgTable("KeysetSample", {
  id: serial().primaryKey(),
  isPinned: boolean().notNull(),
  sortOrder: integer().notNull(),
  createdAt: instant().notNull(),
});

describe("keyset 튜플 비교", () => {
  it("여러 컬럼을 한 튜플로 묶어 앞쪽 행을 고른다", () => {
    // Given
    const columns = [sample.isPinned, sample.sortOrder, sample.id];

    // When
    const query = renderSql(tupleLessThan(columns, [true, 3, 10]));

    // Then
    expect(query).toEqual({
      sql: '("KeysetSample"."isPinned", "KeysetSample"."sortOrder", "KeysetSample"."id") < ($1, $2, $3)',
      params: [true, 3, 10],
    });
  });

  it("Temporal 값은 컬럼 encoder로 ms 3자리 문자열이 되어 뒤쪽 행을 고른다", () => {
    // Given
    const anchor = Temporal.Instant.from("2026-11-10T00:00:00Z");

    // When
    const query = renderSql(tupleGreaterThan([sample.createdAt, sample.id], [anchor, 10]));

    // Then
    expect(query).toEqual({
      sql: '("KeysetSample"."createdAt", "KeysetSample"."id") > ($1, $2)',
      params: ["2026-11-10T00:00:00.000Z", 10],
    });
  });

  it("컬럼과 값의 개수가 다르면 SQL을 만들지 않는다", () => {
    // Given
    const columns = [sample.sortOrder, sample.id];

    // When
    const build = () => tupleLessThan(columns, [3]);

    // Then
    expect(build).toThrow("same length");
  });

  it("기준 행 컬럼과 식은 매개변수 없이 그대로 비교한다", () => {
    // Given
    const anchor = pgTable("KeysetAnchor", { id: serial().primaryKey(), sortOrder: integer() });

    // When
    const query = renderSql(
      tupleLessThan([sample.sortOrder, sample.id], [anchor.sortOrder, anchor.id]),
    );

    // Then
    expect(query).toEqual({
      sql: '("KeysetSample"."sortOrder", "KeysetSample"."id") < ("KeysetAnchor"."sortOrder", "KeysetAnchor"."id")',
      params: [],
    });
  });
});
