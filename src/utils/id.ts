import type { ID } from '@/types'

export function novoId(): ID {
  const c = globalThis.crypto as Crypto | undefined
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  // Fallback para ambientes sem randomUUID
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12)
}
