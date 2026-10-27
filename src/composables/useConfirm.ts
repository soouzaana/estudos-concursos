import { reactive } from 'vue'

export interface PedidoConfirmacao {
  titulo: string
  mensagem: string
  confirmar?: string
  cancelar?: string
  perigo?: boolean
}

interface Estado {
  aberto: boolean
  pedido: PedidoConfirmacao | null
  resolver: ((v: boolean) => void) | null
}

export const estadoConfirmacao = reactive<Estado>({ aberto: false, pedido: null, resolver: null })

/** Abre um diálogo de confirmação e resolve com true/false. */
export function confirmar(pedido: PedidoConfirmacao): Promise<boolean> {
  return new Promise((resolve) => {
    if (estadoConfirmacao.resolver) estadoConfirmacao.resolver(false)
    estadoConfirmacao.pedido = pedido
    estadoConfirmacao.aberto = true
    estadoConfirmacao.resolver = resolve
  })
}

export function responderConfirmacao(valor: boolean) {
  estadoConfirmacao.aberto = false
  const r = estadoConfirmacao.resolver
  estadoConfirmacao.resolver = null
  r?.(valor)
}
