import { assertTodoCommentDevelopmentFixtureTarget } from "./todo-comment-development-fixture-target.guard.js";

const LOCAL_TARGET = {
  nodeEnv: "development",
  apiBaseUrl: "http://localhost:8080",
  databaseUrl: "postgresql://postgres:postgres@127.0.0.1:5433/aido",
};

describe("assertTodoCommentDevelopmentFixtureTarget", () => {
  it("명시적인 local development API와 DB만 허용한다", () => {
    // When
    const result = assertTodoCommentDevelopmentFixtureTarget(LOCAL_TARGET);

    // Then
    expect(result).toMatchObject({
      apiBaseUrl: "http://localhost:8080",
      databaseHost: "127.0.0.1",
      databaseName: "aido",
    });
  });

  it.each([
    { ...LOCAL_TARGET, nodeEnv: "production" },
    { ...LOCAL_TARGET, apiBaseUrl: "https://api.aido.kr" },
    {
      ...LOCAL_TARGET,
      databaseUrl: "postgresql://aido@example.rds.amazonaws.com:5432/aido",
    },
    { ...LOCAL_TARGET, apiBaseUrl: "not-a-url" },
    { ...LOCAL_TARGET, databaseUrl: "postgresql://localhost:5433" },
  ])("환경이 불명확하거나 원격이면 거부한다", (target) => {
    // When
    const check = () => assertTodoCommentDevelopmentFixtureTarget(target);

    // Then
    expect(check).toThrow("[todo-comment-fixture]");
  });
});
