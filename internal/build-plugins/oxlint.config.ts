import { defineConfig } from 'oxlint'

export default defineConfig({
  plugins: ['oxc', 'eslint', 'typescript', 'unicorn', 'import', 'promise'],
  options: {
    typeAware: true,
    typeCheck: true,
    reportUnusedDisableDirectives: 'warn',
  },
})
