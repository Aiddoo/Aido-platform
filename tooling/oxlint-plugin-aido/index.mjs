// Aido 관례 규칙. Oxlint JS 플러그인(alpha)이라 oxlint 버전을 catalog에 고정한다.
// 어느 파일에 거는지는 .oxlintrc.json의 overrides가 정하고, 규칙은 AST 모양만 본다.
import model from './rules/model.mjs';
import modules from './rules/modules.mjs';
import naming from './rules/naming.mjs';
import react from './rules/react.mjs';
import routing from './rules/routing.mjs';
import syntax from './rules/syntax.mjs';
import testing from './rules/testing.mjs';

export default {
  meta: { name: 'aido' },
  rules: { ...model, ...modules, ...naming, ...react, ...routing, ...syntax, ...testing },
};
