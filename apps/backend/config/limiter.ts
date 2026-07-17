import { defineConfig, stores } from '@adonisjs/limiter'
import type { InferLimiters } from '@adonisjs/limiter/types'

/*
 * The in-memory store matches the single-process deployment model (see
 * docs/Architecture.md): counters are per-process and reset on restart,
 * which is acceptable for rate limiting.
 */
const limiterConfig = defineConfig({
  default: 'memory',
  stores: {
    memory: stores.memory({}),
  },
})

export default limiterConfig

declare module '@adonisjs/limiter/types' {
  export interface LimitersList extends InferLimiters<typeof limiterConfig> {}
}
