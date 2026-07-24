function rootCalleeName(node) {
  if (!node) return null;
  if (node.type === "Identifier") return node.name;
  if (node.type === "MemberExpression") return rootCalleeName(node.object);
  if (node.type === "CallExpression") return rootCalleeName(node.callee);
  return null;
}

const oneTestPerFile = {
  meta: {
    type: "problem",
    docs: {
      description: "Allow only one test declaration in each test file",
    },
    messages: {
      missingTest: "This test file does not declare an it(...) or test(...) case.",
      tooManyTests: "This file declares {{ count }} tests. Keep exactly one test per file.",
    },
    schema: [],
  },
  create(context) {
    let testCount = 0;

    return {
      CallExpression(node) {
        const isNestedCallee =
          node.parent?.type === "CallExpression" && node.parent.callee === node;
        if (isNestedCallee) return;

        const name = rootCalleeName(node.callee);
        if (name === "it" || name === "test") testCount += 1;
      },
      "Program:exit"(node) {
        if (testCount === 0) {
          context.report({
            node,
            messageId: "missingTest",
          });
        } else if (testCount > 1) {
          context.report({
            node,
            messageId: "tooManyTests",
            data: { count: testCount },
          });
        }
      },
    };
  },
};

export default {
  rules: {
    "one-test-per-file": oneTestPerFile,
  },
};
