import { defineConfig } from 'oxlint'

export default defineConfig({
  options: {
    typeAware: true,
    typeCheck: true,
    reportUnusedDisableDirectives: 'warn',
  },
  plugins: ['unicorn', 'typescript', 'oxc', 'import', 'promise'],
  settings: {},
  ignorePatterns: ['node_modules', 'dist', 'test'],
  env: { builtin: true },
})
