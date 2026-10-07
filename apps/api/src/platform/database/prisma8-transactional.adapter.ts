import { randomUUID } from "node:crypto";

import type { TransactionalAdapter, TransactionalAdapterOptions } from "@nestjs-cls/transactional";
import type { InjectionToken } from "@nestjs/common";
import sql, { raw } from "sql-template-tag";

import { sqlStatement } from "./database-sql.js";
import { DatabaseService } from "./database.service.js";

type NativeTransaction = Parameters<Parameters<DatabaseService["db"]["transaction"]>[0]>[0];
export type Prisma8Transaction = NativeTransaction & { readonly raw: DatabaseService["db"]["raw"] };

/** Native transaction methods live on its prototype and must retain their receiver. */
export function bindDatabaseTransaction(
  tx: NativeTransaction,
  raw: DatabaseService["db"]["raw"],
): Prisma8Transaction {
  return Object.assign(tx, { raw });
}

/** Native Prisma 8 transaction을 CLS에 연결한다. Required 전파와 UoW의 after-commit은 CLS가 소유한다. */
export class Prisma8TransactionalAdapter implements TransactionalAdapter<
  DatabaseService,
  Prisma8Transaction,
  undefined
> {
  readonly connectionToken: InjectionToken;

  constructor(connectionToken: InjectionToken = DatabaseService) {
    this.connectionToken = connectionToken;
  }

  optionsFactory(
    connection: DatabaseService,
  ): TransactionalAdapterOptions<Prisma8Transaction, undefined> {
    const fallback: Prisma8Transaction = Object.assign(connection.db.runtime(), {
      raw: connection.db.raw,
      orm: connection.db.orm,
      sql: connection.db.sql,
      enums: connection.db.enums,
      nativeEnums: connection.db.nativeEnums,
      invalidated: false,
    });

    return {
      getFallbackInstance: () => fallback,
      wrapWithTransaction: async (_options, work, setTx) =>
        connection.db.transaction(async (tx) => {
          setTx(bindDatabaseTransaction(tx, connection.db.raw));
          return work();
        }),
      wrapWithNestedTransaction: async (_options, work, _setTx, tx) => {
        const savepoint = raw(`"aido_${randomUUID().replaceAll("-", "")}"`);
        await tx.execute(
          sqlStatement(tx, sql`SAVEPOINT ${savepoint}`)
            .returnsRow({})
            .build(),
        );
        try {
          const result = await work();
          await tx.execute(
            sqlStatement(tx, sql`RELEASE SAVEPOINT ${savepoint}`)
              .returnsRow({})
              .build(),
          );
          return result;
        } catch (error) {
          await tx.execute(
            sqlStatement(tx, sql`ROLLBACK TO SAVEPOINT ${savepoint}`)
              .returnsRow({})
              .build(),
          );
          await tx.execute(
            sqlStatement(tx, sql`RELEASE SAVEPOINT ${savepoint}`)
              .returnsRow({})
              .build(),
          );
          throw error;
        }
      },
    };
  }
}
