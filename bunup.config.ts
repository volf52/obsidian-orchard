import { type DefineConfigItem, defineWorkspace } from 'bunup'
import orchardCoreConfig from './packages/orchard-core/bunup.config'
import orchardRuntimeCfg from './packages/orchard-runtime/bunup.config'
import orchardPluginConfig from './packages/orchard/bunup.config'

const sharedOpts: Partial<DefineConfigItem> = {
  clean: true,
  dts: true,
  format: 'esm',
  outDir: 'dist',
}

export default defineWorkspace(
  [
    {
      name: '@orchard/runtime',
      root: 'packages/orchard-runtime',
      config: orchardRuntimeCfg,
    },
    {
      name: '@orchard/core',
      root: 'packages/orchard-core',
      config: orchardCoreConfig,
    },
    {
      name: '@orchard/plugin',
      root: 'packages/orchard',
      config: orchardPluginConfig,
    },
  ],
  sharedOpts,
)
