import { getCalleeName, getImportedName, getKeyName, isComponentName, unwrap } from '../ast.mjs';

function isJsxMemberName(name, object, property) {
  return (
    name.type === 'JSXMemberExpression' &&
    name.object.type === 'JSXIdentifier' &&
    name.object.name === object &&
    name.property.name === property
  );
}

function isMeaningfulChild(child) {
  return (
    child.type === 'JSXExpressionContainer' ||
    child.type === 'JSXSpreadChild' ||
    (child.type === 'JSXText' && child.value.trim() !== '')
  );
}

function createRawTextRule(object, property, message) {
  return {
    meta: { type: 'problem' },
    createOnce(context) {
      return {
        JSXElement(node) {
          if (
            isJsxMemberName(node.openingElement.name, object, property) &&
            node.children.some(isMeaningfulChild)
          ) {
            context.report({ node, message });
          }
        },
      };
    },
  };
}

// heroui 글자 부품의 날글자는 앱 글꼴과 글꼴 크기 설정을 따르지 않는다
const tabsLabelText = createRawTextRule(
  'Tabs',
  'Label',
  'Tabs.Label의 날글자는 앱 글꼴을 따르지 않습니다. SegmentTabTrigger, LineTabTrigger를 쓰거나 자식 <Text>로 넣으세요.',
);

const menuItemTitleText = createRawTextRule(
  'Menu',
  'ItemTitle',
  'Menu.ItemTitle의 날글자는 앱 글꼴을 따르지 않습니다. MenuActionItem을 쓰거나 자식 <Text>로 넣으세요.',
);

function isStringNode(node) {
  return (
    (node.type === 'Literal' && typeof node.value === 'string') || node.type === 'TemplateLiteral'
  );
}

function isClassNameAttribute(attribute) {
  return (
    attribute.name.type === 'JSXIdentifier' &&
    (attribute.name.name === 'className' || attribute.name.name.endsWith('ClassName'))
  );
}

/** 문자열을 잇거나 고르는 모양이면 그 이름 */
function describeClassNameComposition(expression) {
  switch (expression.type) {
    case 'TemplateLiteral':
      return expression.expressions.length > 0 ? '템플릿 리터럴' : null;
    case 'BinaryExpression':
      return expression.operator === '+' ? '문자열 더하기' : null;
    case 'ConditionalExpression':
      return isStringNode(expression.consequent) || isStringNode(expression.alternate)
        ? '삼항'
        : null;
    case 'LogicalExpression':
      return expression.operator === '&&' && isStringNode(expression.right) ? '&&' : null;
    default:
      return null;
  }
}

// 조건부 className은 cn, 변형이 둘 이상이면 tv다. 잇거나 고른 문자열은 tailwind-merge를 지나지 않아 충돌한 클래스가 남는다
const noClassNameConcat = {
  meta: { type: 'suggestion' },
  createOnce(context) {
    return {
      JSXAttribute(node) {
        if (!isClassNameAttribute(node) || node.value?.type !== 'JSXExpressionContainer') {
          return;
        }
        const composition = describeClassNameComposition(unwrap(node.value.expression));
        if (composition != null) {
          context.report({
            node,
            message: `${node.name.name}를 ${composition}으로 만들지 않습니다. 조건부 클래스는 cn(…), 변형이 둘 이상이면 tv(*.variants.ts)를 쓰세요.`,
          });
        }
      },
    };
  },
};

const SHARED_VALUE_FACTORIES = new Set([
  'useSharedValue',
  'useDerivedValue',
  'useAnimatedValue',
  'makeMutable',
]);
const SHARED_VALUE_TYPES = new Set(['SharedValue', 'DerivedValue', 'Mutable']);

function isSharedValueType(annotation) {
  const type = annotation?.typeAnnotation;
  return (
    type?.type === 'TSTypeReference' &&
    type.typeName.type === 'Identifier' &&
    SHARED_VALUE_TYPES.has(type.typeName.name)
  );
}

// Reanimated 4는 React Compiler와 함께 쓸 때 .value 대신 .get()·.set()을 권장한다.
// 같은 파일에서 만든 값과 SharedValue 타입을 단 이름만 본다(다른 파일에서 받은 값은 리뷰)
const sharedValueAccessor = {
  meta: { type: 'suggestion' },
  create(context) {
    const sharedValueNames = new Set();
    const valueReads = [];
    function collect(identifier) {
      if (identifier?.type === 'Identifier') {
        sharedValueNames.add(identifier.name);
      }
    }
    return {
      VariableDeclarator(node) {
        const init = unwrap(node.init);
        if (
          init?.type === 'CallExpression' &&
          SHARED_VALUE_FACTORIES.has(getCalleeName(init.callee))
        ) {
          collect(node.id);
        } else if (isSharedValueType(node.id.typeAnnotation)) {
          collect(node.id);
        }
      },
      Identifier(node) {
        if (node.parent.type !== 'VariableDeclarator' && isSharedValueType(node.typeAnnotation)) {
          collect(node);
        }
      },
      TSPropertySignature(node) {
        if (!node.computed && isSharedValueType(node.typeAnnotation)) {
          collect(node.key);
        }
      },
      MemberExpression(node) {
        if (
          !node.computed &&
          node.property.type === 'Identifier' &&
          node.property.name === 'value'
        ) {
          valueReads.push(node);
        }
      },
      'Program:exit'() {
        for (const node of valueReads) {
          const { object } = node;
          const name =
            object.type === 'MemberExpression' && !object.computed
              ? object.property.name
              : object.name;
          if (sharedValueNames.has(name)) {
            context.report({
              node,
              message: `${name}.value 대신 ${name}.get()·${name}.set(…)을 씁니다(Reanimated 4, React Compiler).`,
            });
          }
        }
      },
    };
  },
};

const SPACING_PROP_NAMES = new Set([
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

// 여백은 className으로 쓴다. 한 태그에 spacing prop과 className을 섞지 않는다(gap·flex prop은 대상이 아니다)
const spacingPropsWithClassName = {
  meta: { type: 'suggestion' },
  createOnce(context) {
    return {
      JSXOpeningElement(node) {
        const names = node.attributes
          .filter((attribute) => attribute.type === 'JSXAttribute')
          .map((attribute) => context.sourceCode.getText(attribute.name));
        const spacingNames = names.filter((name) => SPACING_PROP_NAMES.has(name));
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

// useStepper의 Render는 훅을 쓰는 컴포넌트라 함수로 부르면 훅 순서가 부모와 섞인다
const noRenderCall = {
  meta: { type: 'problem' },
  createOnce(context) {
    return {
      CallExpression(node) {
        const { callee } = node;
        if (
          callee.type === 'MemberExpression' &&
          !callee.computed &&
          callee.property.type === 'Identifier' &&
          callee.property.name === 'Render'
        ) {
          context.report({
            node,
            message:
              'X.Render(...)는 훅을 쓰는 컴포넌트라 함수로 부르면 훅 순서가 부모와 섞입니다. <X.Render … /> JSX로 그리세요.',
          });
        }
      },
    };
  },
};

// 카드 면을 그리는 heroui-native 원본. SurfaceCard(shared/ui)는 Surface를 감싼다
const CARD_COMPONENTS = new Set(['Card', 'Surface']);

// 이름이 -card인 컴포넌트는 heroui-native Card나 Surface를 쓴다. 목록 행이면 -row, 다른 원본이면 그 원본 이름이다
const cardUsesHerouiCard = {
  meta: { type: 'suggestion' },
  createOnce(context) {
    return {
      Program(program) {
        const importsCard = program.body.some(
          (statement) =>
            statement.type === 'ImportDeclaration' &&
            statement.source.value === 'heroui-native' &&
            statement.specifiers.some(
              (specifier) =>
                specifier.type === 'ImportSpecifier' &&
                CARD_COMPONENTS.has(getImportedName(specifier)),
            ),
        );
        if (!importsCard) {
          context.report({
            node: program,
            message:
              '이름이 -card인 컴포넌트는 heroui-native Card나 Surface를 써야 합니다. 목록 행이면 -row로, 다른 원본이면 그 원본 이름으로 바꾸세요.',
          });
        }
      },
    };
  },
};

const ROUTE_IDENTIFIER_PROP_NAMES = new Set([
  'anchorCommentId',
  'commentId',
  'focusCommentId',
  'parentId',
  'rootId',
  'threadId',
  'todoId',
]);
const CALL_THROUGH_TYPES = new Set(['TSAsExpression', 'TSSatisfiesExpression']);

function getAssignedName(left) {
  if (left.type === 'Identifier') {
    return left.name;
  }
  return left.type === 'MemberExpression' && !left.computed ? (left.property.name ?? null) : null;
}

function isComponentFunction(node) {
  if (node.type !== 'ArrowFunctionExpression' && isComponentName(node.id?.name ?? null)) {
    return true;
  }
  if (node.type === 'FunctionDeclaration') {
    return node.id == null && node.parent.type === 'ExportDefaultDeclaration';
  }
  let current = node;
  while (current.parent != null) {
    const { parent } = current;
    if (
      CALL_THROUGH_TYPES.has(parent.type) ||
      (parent.type === 'CallExpression' && parent.arguments.includes(current))
    ) {
      current = parent;
      continue;
    }
    if (parent.type === 'VariableDeclarator' && parent.init === current) {
      return parent.id.type === 'Identifier' && isComponentName(parent.id.name);
    }
    if (
      parent.type === 'AssignmentExpression' &&
      parent.operator === '=' &&
      parent.right === current
    ) {
      return isComponentName(getAssignedName(parent.left));
    }
    return parent.type === 'ExportDefaultDeclaration';
  }
  return false;
}

function getPropsMembers(declaration) {
  if (declaration.type === 'TSInterfaceDeclaration') {
    return declaration.body.body;
  }
  const type = declaration.typeAnnotation;
  if (type.type === 'TSTypeLiteral') {
    return type.members;
  }
  if (type.type === 'TSIntersectionType') {
    return type.types.flatMap((member) => (member.type === 'TSTypeLiteral' ? member.members : []));
  }
  return [];
}

function getInlinePropsMembers(type) {
  if (type?.type === 'TSTypeLiteral') {
    return type.members;
  }
  if (type?.type === 'TSIntersectionType') {
    return type.types.flatMap(getInlinePropsMembers);
  }
  return [];
}

// 댓글 화면 식별자는 Expo Router의 검증된 route hook에서 읽는다(.claude/todo-comments.md)
const noRouteIdProps = {
  meta: { type: 'suggestion' },
  createOnce(context) {
    function checkMembers(members) {
      for (const member of members) {
        const name = getKeyName(member);
        if (name != null && ROUTE_IDENTIFIER_PROP_NAMES.has(name)) {
          context.report({
            node: member,
            message: `댓글 화면 식별자 ${name}를 props로 전달하지 마세요. Expo Router의 검증된 route hook에서 직접 읽어야 합니다.`,
          });
        }
      }
    }
    function checkDeclaration(node) {
      if (node.id.name.endsWith('Props')) {
        checkMembers(getPropsMembers(node));
      }
    }
    function checkFunction(node) {
      if (!isComponentFunction(node)) {
        return;
      }
      for (const parameter of node.params) {
        const target = parameter.type === 'AssignmentPattern' ? parameter.left : parameter;
        checkMembers(getInlinePropsMembers(target.typeAnnotation?.typeAnnotation));
      }
    }
    return {
      TSInterfaceDeclaration: checkDeclaration,
      TSTypeAliasDeclaration: checkDeclaration,
      FunctionDeclaration: checkFunction,
      FunctionExpression: checkFunction,
      ArrowFunctionExpression: checkFunction,
    };
  },
};

export default {
  'tabs-label-text': tabsLabelText,
  'menu-item-title-text': menuItemTitleText,
  'no-classname-concat': noClassNameConcat,
  'shared-value-accessor': sharedValueAccessor,
  'spacing-props-with-classname': spacingPropsWithClassName,
  'no-render-call': noRenderCall,
  'card-uses-heroui-card': cardUsesHerouiCard,
  'no-route-id-props': noRouteIdProps,
};
