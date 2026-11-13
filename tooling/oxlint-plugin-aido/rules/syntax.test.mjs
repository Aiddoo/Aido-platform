import { createRuleTester } from '../rule-tester.mjs';
import rules from './syntax.mjs';

const tester = createRuleTester();

tester.run('no-strict-nullish', rules['no-strict-nullish'], {
  valid: ['if (value == null) {}', 'if (value != undefined) {}', "if (value === '') {}"],
  invalid: [
    { code: 'if (value === null) {}', errors: 1 },
    { code: 'if (undefined !== value) {}', errors: 1 },
  ],
});

tester.run('range-comparison-order', rules['range-comparison-order'], {
  valid: [
    'const inRange = min <= value && value <= max;',
    'const both = 0 < a && 0 > b;',
    'const sameDirection = a < b && b < c;',
  ],
  invalid: [
    { code: 'const inRange = value >= min && value <= max;', errors: 1 },
    { code: 'const inRange = ready && value > min && value < max;', errors: 1 },
    { code: 'const inRange = min < value && max > value;', errors: 1 },
  ],
});

tester.run('function-declaration', rules['function-declaration'], {
  valid: [
    'function toLabel() {}',
    'const Label = styled(Text);',
    'const Row = memo(function Row() { return null; });',
    'function Screen() { const onPress = () => {}; }',
  ],
  invalid: [
    { code: 'const toLabel = () => {};', errors: 1 },
    { code: 'export const toLabel = function () {};', errors: 1 },
    { code: 'const Row = memo(() => null);', errors: 1 },
    { code: 'const Input = forwardRef((props, ref) => null) as typeof Base;', errors: 1 },
  ],
});

tester.run('worklet-param-default', rules['worklet-param-default'], {
  valid: [
    "function clamp(value, min) { 'worklet'; return value; }",
    'function clamp(value = 0) { return value; }',
  ],
  invalid: [
    { code: "function clamp(value, min = 0) { 'worklet'; return value; }", errors: 1 },
    { code: "const clamp = ({ min = 0 }) => { 'worklet'; return min; };", errors: 1 },
    { code: "const clamp = ([first = 0]) => { 'worklet'; return first; };", errors: 1 },
  ],
});

tester.run('no-role-comparison', rules['no-role-comparison'], {
  valid: ['const isAdmin = UserPolicy.isAdmin(user);', 'const same = role == USER_ROLE.ADMIN;'],
  invalid: [
    { code: 'const isAdmin = user.role === USER_ROLE.ADMIN;', errors: 1 },
    { code: 'const isTrial = PREMIUM_SOURCE.TRIAL !== source;', errors: 1 },
  ],
});
