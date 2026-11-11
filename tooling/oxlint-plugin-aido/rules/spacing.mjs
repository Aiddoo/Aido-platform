import { unwrap } from '../ast.mjs';

// Box·Flex·HStack·VStack·Grid가 style로 바꾸는 여백 prop(값은 px 숫자)
const PADDING_MARGIN_PROP_NAMES = new Set([
  'p',
  'px',
  'py',
  'pt',
  'pb',
  'pl',
  'pr',
  'm',
  'mx',
  'my',
  'mt',
  'mb',
  'ml',
  'mr',
]);
const LAYOUT_SPACING_PROP_NAMES = new Set([
  ...PADDING_MARGIN_PROP_NAMES,
  'gap',
  'rowGap',
  'columnGap',
]);

// apps/mobile/docs/design.md의 간격 규격(px). Tailwind의 이름 붙은 간격 단계(0~96)와 같다
const DEFAULT_SPACING_SCALE = [
  0, 1, 2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32, 36, 40, 44, 48, 56, 64, 80, 96,
];

// Tailwind 여백 유틸리티. auto·safe(안전 영역)는 여백 단계가 아니라 보지 않는다
const SPACING_CLASS =
  /^-?(?:p[xytblrse]?|m[xytblrse]?|gap(?:-[xy])?|space-[xy])-(\d+(?:\.\d+)?|px|\[[^\]]+\])$/u;
const ARBITRARY_PX = /^\[(\d+(?:\.\d+)?)px\]$/u;
// Tailwind v4 여백 한 단계(--spacing)는 4px이고 0.25단계 값을 만든다
const SPACING_STEP_PX = 4;
const SPACING_STEP_FRACTION = 0.25;

function getAttributeName(attribute) {
  return attribute.type === 'JSXAttribute' && attribute.name.type === 'JSXIdentifier'
    ? attribute.name.name
    : null;
}

function getRootElementName(name) {
  if (name.type === 'JSXIdentifier') {
    return name.name;
  }
  return name.type === 'JSXMemberExpression' ? getRootElementName(name.object) : null;
}

/** `dark:-mt-2!`처럼 변형 접두사·중요도 표시를 뗀 여백 유틸리티면 [토큰, 값] */
function* spacingClassTokens(text) {
  for (const token of text.split(/\s+/u)) {
    const utility = token.slice(token.lastIndexOf(':') + 1).replace(/^!|!$/gu, '');
    const match = SPACING_CLASS.exec(utility);
    if (match != null) {
      yield [token, match[1]];
    }
  }
}

/** className 식에서 글자로 쓴 클래스 조각. cn(…)·삼항·&& 안까지 본다 */
function* classNameTexts(expression) {
  const node = unwrap(expression);
  switch (node?.type) {
    case 'Literal':
      if (typeof node.value === 'string') {
        yield node.value;
      }
      return;
    case 'TemplateLiteral':
      for (const quasi of node.quasis) {
        yield quasi.value.cooked ?? quasi.value.raw;
      }
      return;
    case 'JSXExpressionContainer':
      yield* classNameTexts(node.expression);
      return;
    case 'ConditionalExpression':
      yield* classNameTexts(node.consequent);
      yield* classNameTexts(node.alternate);
      return;
    case 'LogicalExpression':
      yield* classNameTexts(node.left);
      yield* classNameTexts(node.right);
      return;
    case 'CallExpression':
      for (const argument of node.arguments) {
        yield* classNameTexts(argument);
      }
      return;
    case 'ArrayExpression':
      for (const element of node.elements) {
        yield* classNameTexts(element);
      }
      return;
    default:
      return;
  }
}

// 여백은 className으로 쓴다. 한 태그에 spacing prop과 className을 섞지 않는다(gap·flex prop은 대상이 아니다)
const spacingPropsWithClassName = {
  meta: { type: 'suggestion' },
  createOnce(context) {
    return {
      JSXOpeningElement(node) {
        const names = node.attributes
          .filter((attribute) => attribute.type === 'JSXAttribute')
          .map((attribute) => context.sourceCode.getText(attribute.name));
        const spacingNames = names.filter((name) => PADDING_MARGIN_PROP_NAMES.has(name));
        if (spacingNames.length > 0 && names.includes('className')) {
          context.report({
            node,
            message: `spacing prop(${spacingNames.join(', ')})과 className을 한 태그에 섞지 않습니다. 여백은 className으로 씁니다.`,
          });
        }
      },
    };
  },
};

// 레이아웃 prop과 <Spacing size>의 숫자는 간격 규격 안이다. 같은 파일 const는 따라가고 다른 파일 상수는 리뷰한다
const spacingScale = {
  meta: {
    type: 'suggestion',
    schema: [
      {
        type: 'object',
        properties: { allowed: { type: 'array', items: { type: 'number' } } },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const allowed = context.options[0]?.allowed ?? DEFAULT_SPACING_SCALE;
    const allowedValues = new Set(allowed);
    const constantInits = new Map();
    const attributes = [];

    function* numbersOf(expression, constantName, visited) {
      const node = unwrap(expression);
      if (node?.type === 'Literal' && typeof node.value === 'number') {
        yield { value: node.value, constantName };
      } else if (
        node?.type === 'UnaryExpression' &&
        node.operator === '-' &&
        node.argument.type === 'Literal' &&
        typeof node.argument.value === 'number'
      ) {
        yield { value: -node.argument.value, constantName };
      } else if (node?.type === 'ConditionalExpression') {
        yield* numbersOf(node.consequent, constantName, visited);
        yield* numbersOf(node.alternate, constantName, visited);
      } else if (node?.type === 'LogicalExpression') {
        yield* numbersOf(node.left, constantName, visited);
        yield* numbersOf(node.right, constantName, visited);
      } else if (
        node?.type === 'Identifier' &&
        constantInits.has(node.name) &&
        !visited.has(node.name)
      ) {
        yield* numbersOf(
          constantInits.get(node.name),
          constantName ?? node.name,
          new Set([...visited, node.name]),
        );
      }
    }

    return {
      VariableDeclarator(node) {
        if (node.parent.kind === 'const' && node.id.type === 'Identifier' && node.init != null) {
          constantInits.set(node.id.name, node.init);
        }
      },
      JSXAttribute(node) {
        const name = getAttributeName(node);
        const isSpacingSize = name === 'size' && getRootElementName(node.parent.name) === 'Spacing';
        if (
          (isSpacingSize || LAYOUT_SPACING_PROP_NAMES.has(name)) &&
          node.value?.type === 'JSXExpressionContainer'
        ) {
          attributes.push({ node, name });
        }
      },
      'Program:exit'() {
        for (const { node, name } of attributes) {
          for (const { value, constantName } of numbersOf(node.value.expression, null, new Set())) {
            if (allowedValues.has(Math.abs(value))) {
              continue;
            }
            const written = constantName == null ? `${value}` : `${constantName}(${value})`;
            context.report({
              node,
              message: `${name}={${written}}: 간격 규격(${allowed.join('·')}) 밖의 값입니다. 규격 값으로 맞추고, 의도한 값이면 design.md 간격 예외에 올린 뒤 그 줄 위에 // oxlint-disable-next-line aido/spacing-scale -- <이유>를 남기세요.`,
            });
          }
        }
      },
    };
  },
};

function describeEqualToken(token, pixels) {
  const steps = pixels / SPACING_STEP_PX;
  if (steps % SPACING_STEP_FRACTION !== 0) {
    return `${pixels}px와 같은 토큰이 없습니다(토큰은 1px 단위). 값을 간격 규격으로 맞추거나 배치를 바꾸세요.`;
  }
  return `같은 값 토큰으로 바꾸세요: ${token.replace(/\[[^\]]+\]/u, `${steps}`)}`;
}

// 여백 클래스는 토큰 단계로 쓴다(18px → 4.5). 임의 픽셀은 규격을 우회해 화면마다 값이 흩어진다
const noArbitrarySpacingClass = {
  meta: { type: 'suggestion' },
  createOnce(context) {
    function check(node, text) {
      for (const [token, value] of spacingClassTokens(text)) {
        const pixels = ARBITRARY_PX.exec(value);
        if (pixels != null) {
          context.report({
            node,
            message: `${token}: 임의 픽셀 여백 클래스를 쓰지 않습니다. ${describeEqualToken(token, Number(pixels[1]))}`,
          });
        }
      }
    }
    return {
      Literal(node) {
        if (typeof node.value === 'string') {
          check(node, node.value);
        }
      },
      TemplateElement(node) {
        check(node, node.value.cooked ?? node.value.raw);
      },
    };
  },
};

const NOTATION_LABELS = { prop: '레이아웃 prop', className: 'className 클래스' };
const JSX_PARENT_TYPES = new Set(['JSXElement', 'JSXFragment']);
const JSX_CHILD_WRAPPER_TYPES = new Set([
  'JSXExpressionContainer',
  'LogicalExpression',
  'ConditionalExpression',
  'ParenthesizedExpression',
]);

/** 부모 아래에 같이 그려지는 자식 태그. Fragment·조건부 자식(`{a && <X />}`)은 펼친다 */
function* renderedChildElements(node) {
  const target = unwrap(node);
  switch (target?.type) {
    case 'JSXElement':
      yield target;
      return;
    case 'JSXFragment':
      for (const child of target.children) {
        yield* renderedChildElements(child);
      }
      return;
    case 'JSXExpressionContainer':
      yield* renderedChildElements(target.expression);
      return;
    case 'LogicalExpression':
      yield* renderedChildElements(target.left);
      yield* renderedChildElements(target.right);
      return;
    case 'ConditionalExpression':
      yield* renderedChildElements(target.consequent);
      yield* renderedChildElements(target.alternate);
      return;
    default:
      return;
  }
}

/** 바깥 JSX 부모의 자식으로 펼쳐지는 Fragment면 그 부모가 판정한다 */
function isFlattenedFragment(node) {
  let current = node.parent;
  while (current != null && JSX_CHILD_WRAPPER_TYPES.has(current.type)) {
    current = current.parent;
  }
  return current != null && JSX_PARENT_TYPES.has(current.type);
}

// 형제끼리는 여백 표기 하나다. 같은 부모 아래 자식이 레이아웃 prop(`gap={8}`)과 className 클래스(`gap-2`)를 섞지 않는다.
// 부모·자식 사이와 다른 부모 아래는 섞어도 된다. ignoreClassNameFrom 모듈(heroui-native 등 레이아웃 prop이 없는 부품)의
// 태그와 `*ClassName` 슬롯은 prop으로 바꿀 수 없어 세지 않는다
const oneSpacingNotation = {
  meta: {
    type: 'suggestion',
    schema: [
      {
        type: 'object',
        properties: { ignoreClassNameFrom: { type: 'array', items: { type: 'string' } } },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const ignoredSources = new Set(context.options[0]?.ignoreClassNameFrom ?? []);
    const ignoredNames = new Set();

    /** 이 태그가 쓰는 표기마다 처음 보인 예 */
    function getNotations(element) {
      const notations = new Map();
      const opening = element.openingElement;
      if (ignoredNames.has(getRootElementName(opening.name))) {
        return notations;
      }
      for (const attribute of opening.attributes) {
        const name = getAttributeName(attribute);
        if (LAYOUT_SPACING_PROP_NAMES.has(name) && !notations.has('prop')) {
          notations.set('prop', context.sourceCode.getText(attribute));
        } else if (name === 'className' && attribute.value != null && !notations.has('className')) {
          const [token] = [...classNameTexts(attribute.value)].flatMap((text) =>
            [...spacingClassTokens(text)].map(([classToken]) => classToken),
          );
          if (token != null) {
            notations.set('className', token);
          }
        }
      }
      return notations;
    }

    // 한 태그 안에서 두 표기를 함께 쓰는 것은 형제 섞임이 아니라 다른 자식끼리만 짝짓는다
    function findMixedPair(uses, firstNotation, secondNotation) {
      const first = uses[firstNotation][0];
      const second = uses[secondNotation].find((use) => use.child !== first.child);
      return second == null ? null : { firstNotation, first, secondNotation, second };
    }

    function checkSiblings(parentName, children) {
      const uses = { prop: [], className: [] };
      for (const child of children) {
        for (const [notation, example] of getNotations(child)) {
          uses[notation].push({ child, example });
        }
      }
      if (uses.prop.length === 0 || uses.className.length === 0) {
        return;
      }
      const [earlier, later] =
        children.indexOf(uses.prop[0].child) <= children.indexOf(uses.className[0].child)
          ? ['prop', 'className']
          : ['className', 'prop'];
      const pair = findMixedPair(uses, earlier, later) ?? findMixedPair(uses, later, earlier);
      if (pair == null) {
        return;
      }
      const { firstNotation, first, secondNotation, second } = pair;
      context.report({
        node: second.child.openingElement,
        message: `${parentName}의 자식들이 여백 표기를 섞습니다: ${NOTATION_LABELS[firstNotation]}(${first.example}), ${NOTATION_LABELS[secondNotation]}(${second.example}). 형제는 한 표기로 맞추세요(prop 자식 ${uses.prop.length}개, 클래스 자식 ${uses.className.length}개).`,
      });
    }

    return {
      ImportDeclaration(node) {
        if (ignoredSources.has(node.source.value)) {
          for (const specifier of node.specifiers) {
            ignoredNames.add(specifier.local.name);
          }
        }
      },
      JSXElement(node) {
        const children = node.children.flatMap((child) => [...renderedChildElements(child)]);
        checkSiblings(`<${context.sourceCode.getText(node.openingElement.name)}>`, children);
      },
      JSXFragment(node) {
        if (!isFlattenedFragment(node)) {
          const children = node.children.flatMap((child) => [...renderedChildElements(child)]);
          checkSiblings('<>', children);
        }
      },
    };
  },
};

export default {
  'spacing-props-with-classname': spacingPropsWithClassName,
  'spacing-scale': spacingScale,
  'no-arbitrary-spacing-class': noArbitrarySpacingClass,
  'one-spacing-notation': oneSpacingNotation,
};
