import { defineConfig } from 'oxlint'

export default defineConfig({
  plugins: ['unicorn', 'typescript', 'oxc', 'import', 'promise'],
  ignorePatterns: ['node_modules', 'dist', 'test'],
  env: { builtin: true },
})
