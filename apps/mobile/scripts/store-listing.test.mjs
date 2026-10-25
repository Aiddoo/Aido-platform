import assert from 'node:assert/strict';
import { test } from 'node:test';

import { characterCount, checkListings, keywordProblems } from './store-listing.mjs';

test('저장소의 스토어 등록 정보가 한도와 규칙을 지킨다', () => {
  assert.deepEqual(checkListings().errors, []);
});

test('글자 수는 유니코드 글자 기준이다', () => {
  assert.equal(characterCount('아이두 - AI'), 8);
});

test('키워드는 공백·중복·이름과 겹치는 단어를 막는다', () => {
  const title = { name: 'Aido - AI To-do Planner', subtitle: 'Get it done with friends & AI' };
  assert.deepEqual(keywordProblems('todo,habit', title).problems, []);
  assert.match(keywordProblems('todo, habit', title).problems.join(), /공백/u);
  assert.match(keywordProblems('todo,Todo', title).problems.join(), /중복/u);
  assert.match(keywordProblems('planner,habit', title).problems.join(), /겹치는/u);
  assert.match(keywordProblems('ai,habit', { name: '', subtitle: '' }).problems.join(), /3글자/u);
  assert.match(keywordProblems('습관,루틴관리', {}).problems.join(), /3글자/u);
});

test('키워드 한도는 글자 수 기준이라 한글 100자 안이면 통과한다', () => {
  const result = keywordProblems(
    '할일관리,투두리스트,체크리스트,습관만들기,루틴관리,캘린더,일정관리,리마인더',
    {},
  );
  assert.deepEqual(result.problems, []);
  assert.deepEqual(result.warnings, []);
});
