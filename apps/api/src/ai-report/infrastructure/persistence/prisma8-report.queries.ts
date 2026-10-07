import type { DatabaseService } from "#api/shared/infrastructure/database/database.service";

/** 고정 쿼리 형태를 한 번 컴파일하고 사용자·기간은 호출마다 바인딩한다. */
export async function prepareReportQueries(db: DatabaseService["db"]) {
  const { Todo, TodoCategory } = db.orm.public;
  const [daily, previous, category, categories, completed] = await Promise.all([
    db.prepare(
      { userId: "pg/text@1", start: "pg/date-string@1", end: "pg/date-string@1" },
      (params) =>
        Todo.where((todo) => todo.userId.eq(params.userId))
          .where((todo) => todo.startDate.gte(params.start))
          .where((todo) => todo.startDate.lt(params.end))
          .groupBy("startDate", "completed")
          .prepared.aggregate((aggregate) => ({ count: aggregate.count() })),
    ),
    db.prepare(
      { userId: "pg/text@1", start: "pg/date-string@1", end: "pg/date-string@1" },
      (params) =>
        Todo.where((todo) => todo.userId.eq(params.userId))
          .where((todo) => todo.startDate.gte(params.start))
          .where((todo) => todo.startDate.lt(params.end))
          .groupBy("completed")
          .prepared.aggregate((aggregate) => ({ count: aggregate.count() })),
    ),
    db.prepare(
      { userId: "pg/text@1", start: "pg/date-string@1", end: "pg/date-string@1" },
      (params) =>
        Todo.where((todo) => todo.userId.eq(params.userId))
          .where((todo) => todo.startDate.gte(params.start))
          .where((todo) => todo.startDate.lt(params.end))
          .groupBy("categoryId", "completed")
          .prepared.aggregate((aggregate) => ({ count: aggregate.count() })),
    ),
    db.prepare({ userId: "pg/text@1" }, (params) =>
      TodoCategory.where((category) => category.userId.eq(params.userId))
        .select("id", "name", "color")
        .prepared.all(),
    ),
    db.prepare(
      { userId: "pg/text@1", start: "pg/date-string@1", end: "pg/date-string@1" },
      (params) =>
        Todo.where((todo) => todo.userId.eq(params.userId))
          .where((todo) => todo.startDate.gte(params.start))
          .where((todo) => todo.startDate.lt(params.end))
          .where((todo) => todo.completed.eq(true))
          .where((todo) => todo.completedAt.isNotNull())
          .select("startDate", "completedAt")
          .prepared.all(),
    ),
  ]);
  return { daily, previous, category, categories, completed };
}
