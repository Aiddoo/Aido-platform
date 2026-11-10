import { type ExistingTodo, findDuplicateTodoId } from "./action-plan-dedupe.domain-service.js";

const existing: readonly ExistingTodo[] = [
  { id: 1, title: "치과 예약", startDate: "2027-01-05", isRepeating: false },
  { id: 2, title: "Team Standup!", startDate: "2027-01-04", isRepeating: true },
];

describe("findDuplicateTodoId", () => {
  it.each([
    { title: "치과예약", startDate: "2027-01-05", expected: 1, why: "띄어쓰기만 다르고 같은 날" },
    { title: "치과 예약", startDate: "2027-01-06", expected: null, why: "제목은 같고 다른 날" },
    { title: "team  standup", startDate: "2027-02-01", expected: 2, why: "진행 중인 반복 할 일" },
    { title: "회의록 보내기", startDate: "2027-01-05", expected: null, why: "다른 제목" },
  ])("$why이면 $expected다", ({ title, startDate, expected }) => {
    // Given
    const todo = { title, startDate, duplicateOfTodoId: null };
    // When
    const found = findDuplicateTodoId(todo, existing);
    // Then
    expect(found).toBe(expected);
  });

  it("AI가 고른 겹침 id를 먼저 쓴다", () => {
    // Given
    const todo = { title: "완전히 다른 제목", startDate: "2027-01-05", duplicateOfTodoId: 1 };
    // When
    const found = findDuplicateTodoId(todo, existing);
    // Then
    expect(found).toBe(1);
  });
});
