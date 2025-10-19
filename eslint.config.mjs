import andrewaylett from 'eslint-config-andrewaylett';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    {
        ignores: [
            '**/node_modules/*',
            '**/dist/*',
            '**/.wrangler/*',
            'vitest.config.ts',
        ],
    },
    {
        languageOptions: {
            parserOptions: {
                project: true,
                projectService: {
                    allowDefaultProject: ['*.js', '*.mjs', '*.ts'],
                },
            },
            globals: {
                ...globals['shared-node-browser'],
            },
        },
    },
    {
        files: ['**/*.ts', '**/*.mts', '**/*.tsx', '**/*.mtsx'],
        ...andrewaylett.configs.recommendedWithTypes,
        rules: {
            // Allow non-null assertions in UI code where DOM nodes are required.
            '@typescript-eslint/no-non-null-assertion': 'off',
        },
    },
    {
        files: ['**/*.test.ts', '**/*.test.mts', '**/*.test.tsx'],
        rules: {
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-unsafe-assignment': 'off',
            '@typescript-eslint/no-unsafe-member-access': 'off',
            '@typescript-eslint/no-unsafe-call': 'off',
            '@typescript-eslint/no-unsafe-argument': 'off',
            '@typescript-eslint/require-await': 'off',
            '@typescript-eslint/no-empty-function': 'off',
            '@typescript-eslint/unbound-method': 'off',
            '@typescript-eslint/no-deprecated': 'off',
        },
    },
);
