/* eslint-env node */
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    rules: {
       'react/display-name': 'off',
       'global-require': 0,
       'react-hooks/exhaustive-deps': 'off',
        quotes: ['error', 'single'],
       'object-curly-spacing': ['error', 'always'],
       'array-bracket-spacing': ['error', 'never'],
       'react/default-props-match-prop-types': ['error'],
       'react/sort-prop-types': ['error'],
       'react/no-array-index-key': 'off',
       'no-tabs': 'off',
       'no-void': 'off',
       'react/jsx-props-no-spreading': 'off',
       'react/jsx-no-target-blank': 'off',
       'react/jsx-curly-brace-presence': ['error'],
       'react/react-in-jsx-scope': 'off',
       'react/no-unstable-nested-components': 'off',
        semi: 'error',
        indent: ['off'],
       'comma-spacing': ['error', { after: true }],
       'space-infix-ops': 'error',
       'key-spacing': 'error',
       'default-case': 'off',
       'keyword-spacing': [
           'error',
            {
                before: true,
                after: true,
            },
        ],
       'arrow-spacing': 'error',
       'import/no-unused-modules': 'error',
       'react/self-closing-comp': ['error'],
    },
  },
]);
