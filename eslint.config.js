import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

const gsapPlugin = {
  rules: {
    'require-import': {
      meta: {
        type: 'problem',
        fixable: 'code',
        messages: {
          missing: 'gsap must be imported explicitly: import gsap from "gsap"',
        },
      },
      create(context) {
        let hasGsapImport = false;

        return {
          ImportDeclaration(node) {
            if (node.source.value === 'gsap') {
              hasGsapImport = true;
            }
          },
          'Program:exit'(program) {
            if (hasGsapImport) return;

            const sourceCode = context.sourceCode;
            const globalScope = sourceCode.scopeManager.globalScope;
            const moduleScope = globalScope?.childScopes[0];
            const gsapRefs = (moduleScope?.through ?? []).filter((ref) => ref.identifier.name === 'gsap');

            if (gsapRefs.length === 0) return;

            const imports = program.body.filter((n) => n.type === 'ImportDeclaration');

            context.report({
              node: gsapRefs[0].identifier,
              messageId: 'missing',
              fix(fixer) {
                if (imports.length > 0) {
                  return fixer.insertTextAfter(imports[imports.length - 1], "\nimport gsap from 'gsap';");
                }
                return fixer.insertTextBefore(program.body[0], "import gsap from 'gsap';\n");
              },
            });
          },
        };
      },
    },
  },
};

export default tseslint.config(
  {
    ignores: ['**/*', '!src/**'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: { gsap: gsapPlugin },
    rules: {
      'gsap/require-import': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
        },
      ],
      'spaced-comment': [
        'warn',
        'always',
        {
          markers: ['/'],
        },
      ],
    },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parser: tseslint.parser,
      globals: {
        window: true,
        document: true,
      },
    },
    linterOptions: {
      reportUnusedDisableDirectives: true,
    },
  },
);
