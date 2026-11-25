import {
  childNodes,
  getCalleeName,
  getImportedName,
  getKeyName,
  isComponentName,
  isFunction,
  unwrap,
} from '../ast.mjs';

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

// route params 스키마(schemas/*-params.schema.ts)가 읽는 식별자와 댓글 위치 식별자
const ROUTE_IDENTIFIER_PROP_NAMES = new Set([
  'anchorCommentId',
  'categoryId',
  'commentId',
  'draftId',
  'focusCommentId',
  'friendId',
  'importId',
  'memoId',
  'nudgeId',
  'parentId',
  'releaseId',
  'reportId',
  'rootId',
  'subTodoId',
  'suggestionId',
  'threadId',
  'todoId',
]);
// 목록 행은 행마다 route를 파싱하지 않게 부모가 넘긴 id를 받는다(docs/architecture/state-and-routing.md)
const LIST_ROW_NAME = /(?:Item|Row)$/u;
const CALL_THROUGH_TYPES = new Set(['TSAsExpression', 'TSSatisfiesExpression']);
const DEFAULT_EXPORT = Symbol('default export');

/**
 * 파일이 내보내는 컴포넌트 함수의 이름(`export default`는 DEFAULT_EXPORT). 아니면 null.
 * 같은 파일 조각(`X.Contents`, 지역 컴포넌트)은 부모가 좁힌 id를 받으므로 보지 않는다
 */
function getExportedComponentName(node) {
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
    if (parent.type === 'ExportDefaultDeclaration') {
      return current.id == null || isComponentName(current.id.name) ? DEFAULT_EXPORT : null;
    }
    if (parent.type === 'ExportNamedDeclaration' && current.type === 'FunctionDeclaration') {
      return isComponentName(current.id?.name ?? null) ? current.id.name : null;
    }
    if (
      parent.type === 'VariableDeclarator' &&
      parent.init === current &&
      parent.id.type === 'Identifier' &&
      parent.parent?.parent?.type === 'ExportNamedDeclaration'
    ) {
      return isComponentName(parent.id.name) ? parent.id.name : null;
    }
    return null;
  }
  return null;
}

function collectExportedNames(program) {
  const names = new Set();
  for (const statement of program.body) {
    const declaration = statement.type === 'ExportNamedDeclaration' ? statement.declaration : null;
    if (declaration?.type === 'FunctionDeclaration' && declaration.id != null) {
      names.add(declaration.id.name);
    }
    if (declaration?.type === 'VariableDeclaration') {
      for (const declarator of declaration.declarations) {
        if (declarator.id.type === 'Identifier') {
          names.add(declarator.id.name);
        }
      }
    }
  }
  return names;
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

// 화면 식별자는 Expo Router의 검증된 route 튜플 훅에서 읽는다(docs/architecture/ui.md#컴포넌트-계약).
// 내보내는 컴포넌트와 그 `{이름}Props`만 본다. 목록 행(`*Item`·`*Row`)은 예외다
const noRouteIdProps = {
  meta: { type: 'suggestion' },
  create(context) {
    let exportedNames = new Set();
    function checkMembers(members) {
      for (const member of members) {
        const name = getKeyName(member);
        if (name != null && ROUTE_IDENTIFIER_PROP_NAMES.has(name)) {
          context.report({
            node: member,
            message: `화면 식별자 ${name}를 props로 전달하지 마세요. 그 화면의 route 튜플 훅(const [${name}] = use…())으로 읽습니다. 목록 행이면 X.Item·*Row로 이름 짓고 부모가 넘깁니다.`,
          });
        }
      }
    }
    function checkDeclaration(node) {
      const componentName = node.id.name.endsWith('Props') ? node.id.name.slice(0, -5) : null;
      if (
        componentName != null &&
        exportedNames.has(componentName) &&
        isComponentName(componentName) &&
        !LIST_ROW_NAME.test(componentName)
      ) {
        checkMembers(getPropsMembers(node));
      }
    }
    function checkFunction(node) {
      const componentName = getExportedComponentName(node);
      if (
        componentName == null ||
        (typeof componentName === 'string' && LIST_ROW_NAME.test(componentName))
      ) {
        return;
      }
      for (const parameter of node.params) {
        const target = parameter.type === 'AssignmentPattern' ? parameter.left : parameter;
        checkMembers(getInlinePropsMembers(target.typeAnnotation?.typeAnnotation));
      }
    }
    return {
      Program(program) {
        exportedNames = collectExportedNames(program);
      },
      TSInterfaceDeclaration: checkDeclaration,
      TSTypeAliasDeclaration: checkDeclaration,
      FunctionDeclaration: checkFunction,
      FunctionExpression: checkFunction,
      ArrowFunctionExpression: checkFunction,
    };
  },
};

// 조회 실패 자리는 조회 컴포넌트의 X.Error, 실패하면 비우는 조각은 QueryErrorFallback.Hidden 하나로 건다(docs/architecture/ui.md)
const errorBoundaryFallback = {
  meta: { type: 'suggestion' },
  createOnce(context) {
    return {
      JSXAttribute(node) {
        const element = node.parent;
        if (
          node.name.type !== 'JSXIdentifier' ||
          node.name.name !== 'fallback' ||
          element?.name.type !== 'JSXIdentifier' ||
          element.name.name !== 'QueryErrorBoundary' ||
          node.value?.type !== 'JSXExpressionContainer' ||
          !isFunction(unwrap(node.value.expression))
        ) {
          return;
        }
        context.report({
          node,
          message:
            'QueryErrorBoundary의 fallback에 인라인 함수를 쓰지 않습니다. 조회 컴포넌트의 fallback={X.Error}, 실패하면 비우는 조각은 fallback={QueryErrorFallback.Hidden}을 겁니다.',
        });
      },
    };
  },
};

// Props는 interface로 선언하고 원본을 넓히면 extends Omit<ComponentProps<typeof X>, …>다. 더할 것 없는 별칭(type XProps = Omit<…>)은 type이다
const propsInterface = {
  meta: { type: 'suggestion' },
  createOnce(context) {
    return {
      TSTypeAliasDeclaration(node) {
        if (node.id.name.endsWith('Props') && node.typeAnnotation.type === 'TSTypeLiteral') {
          context.report({
            node: node.id,
            message: `${node.id.name}: 객체 리터럴 Props는 interface ${node.id.name} { … }로 씁니다. 원본을 넓히면 interface ${node.id.name} extends Omit<ComponentProps<typeof X>, …>입니다.`,
          });
        }
      },
    };
  },
};

/** props 인자에서 나머지를 받은 이름(`...props`, 인자 `props`)과 그 자리에서 onPress를 꺼냈는지 */
function describePropsParameter(functionNode) {
  const [parameter] = functionNode.params;
  const pattern = parameter?.type === 'AssignmentPattern' ? parameter.left : parameter;
  if (pattern?.type === 'Identifier') {
    return { restName: pattern.name, takesOnPress: false };
  }
  if (pattern?.type !== 'ObjectPattern') {
    return null;
  }
  const rest = pattern.properties.find((property) => property.type === 'RestElement');
  if (rest?.argument.type !== 'Identifier') {
    return null;
  }
  return {
    restName: rest.argument.name,
    takesOnPress: pattern.properties.some(
      (property) => property.type === 'Property' && getKeyName(property) === 'onPress',
    ),
  };
}

/** `props.onPress`나 `const { onPress } = props`로 받은 onPress를 읽는지 */
function readsOnPress(node, restName) {
  if (
    node.type === 'MemberExpression' &&
    !node.computed &&
    node.object.type === 'Identifier' &&
    node.object.name === restName &&
    node.property.name === 'onPress'
  ) {
    return true;
  }
  if (
    node.type === 'VariableDeclarator' &&
    node.init?.type === 'Identifier' &&
    node.init.name === restName &&
    node.id.type === 'ObjectPattern' &&
    node.id.properties.some(
      (property) => property.type === 'Property' && getKeyName(property) === 'onPress',
    )
  ) {
    return true;
  }
  for (const child of childNodes(node)) {
    if (readsOnPress(child, restName)) {
      return true;
    }
  }
  return false;
}

function findPropsOwner(node, restName) {
  for (let current = node.parent; current != null; current = current.parent) {
    if (isFunction(current) || current.type === 'FunctionDeclaration') {
      const props = describePropsParameter(current);
      if (props?.restName === restName) {
        return { functionNode: current, takesOnPress: props.takesOnPress };
      }
    }
  }
  return null;
}

// `Popover.Trigger asChild`·`Link asChild`·코치마크는 자식에 onPress를 넣는다. 나머지 props를 펼친 뒤 onPress를 덮으면
// 그 누름이 조용히 사라지므로, 누름을 스스로 처리하는 부품도 받은 onPress를 꺼내 이어 부른다
const forwardOnPress = {
  meta: { type: 'problem' },
  create(context) {
    return {
      JSXOpeningElement(node) {
        const onPressIndex = node.attributes.findIndex(
          (attribute) => attribute.type === 'JSXAttribute' && attribute.name.name === 'onPress',
        );
        if (onPressIndex < 0) {
          return;
        }
        const overridden = node.attributes.slice(0, onPressIndex).flatMap((attribute) => {
          if (attribute.type !== 'JSXSpreadAttribute' || attribute.argument.type !== 'Identifier') {
            return [];
          }
          const owner = findPropsOwner(node, attribute.argument.name);
          return owner == null ? [] : [{ restName: attribute.argument.name, ...owner }];
        });
        const dropped = overridden.find(
          ({ restName, functionNode, takesOnPress }) =>
            !takesOnPress && !readsOnPress(functionNode.body, restName),
        );
        if (dropped != null) {
          context.report({
            node: node.attributes[onPressIndex],
            message: `{...${dropped.restName}} 뒤의 onPress가 밖에서 받은 onPress를 덮습니다. props에서 onPress를 꺼내 자기 동작 뒤에 이어 부르세요(\`onPress?.(event)\`). asChild 트리거와 코치마크가 자식에 넣은 누름이 사라집니다.`,
          });
        }
      },
    };
  },
};

export default {
  'forward-on-press': forwardOnPress,
  'error-boundary-fallback': errorBoundaryFallback,
  'props-interface': propsInterface,
  'tabs-label-text': tabsLabelText,
  'menu-item-title-text': menuItemTitleText,
  'no-classname-concat': noClassNameConcat,
  'shared-value-accessor': sharedValueAccessor,
  'no-render-call': noRenderCall,
  'card-uses-heroui-card': cardUsesHerouiCard,
  'no-route-id-props': noRouteIdProps,
};
