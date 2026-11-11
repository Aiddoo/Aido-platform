import { getImportedName, getKeyName, isComponentName } from '../ast.mjs';

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

// Tabs.Label의 날글자는 앱 글꼴과 글꼴 크기 설정을 따르지 않는다
const tabsLabelText = {
  meta: { type: 'problem' },
  createOnce(context) {
    return {
      JSXElement(node) {
        if (
          isJsxMemberName(node.openingElement.name, 'Tabs', 'Label') &&
          node.children.some(isMeaningfulChild)
        ) {
          context.report({
            node,
            message:
              'Tabs.Label의 날글자는 앱 글꼴을 따르지 않습니다. SegmentTabTrigger, LineTabTrigger를 쓰거나 자식 <Text>로 넣으세요.',
          });
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
  'spacing-props-with-classname': spacingPropsWithClassName,
  'no-render-call': noRenderCall,
  'card-uses-heroui-card': cardUsesHerouiCard,
  'no-route-id-props': noRouteIdProps,
};
