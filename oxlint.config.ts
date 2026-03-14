import { defineConfig } from 'oxlint'

export default defineConfig({
  plugins: ['unicorn', 'typescript', 'oxc', 'import', 'promise'],
  settings: {},
  ignorePatterns: ['node_modules', 'dist', 'test'],
  env: { builtin: true },
})
