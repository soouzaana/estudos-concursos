import { reactive } from 'vue'

export interface Toast {
  id: number
  tipo: 'sucesso' | 'erro' | 'info'
  texto: string
}

const estado = reactive<{ itens: Toast[] }>({ itens: [] })
let seq = 0

export function useToast() {
  function mostrar(tipo: Toast['tipo'], texto: string, ms = 3800) {
    const id = ++seq
    estado.itens.push({ id, tipo, texto })
    setTimeout(() => remover(id), tipo === 'erro' ? Math.max(ms, 6000) : ms)
  }
  function remover(id: number) {
    const i = estado.itens.findIndex((t) => t.id === id)
    if (i >= 0) estado.itens.splice(i, 1)
  }
  return {
    itens: estado.itens,
    sucesso: (t: string) => mostrar('sucesso', t),
    erro: (t: string) => mostrar('erro', t),
    info: (t: string) => mostrar('info', t),
    remover
  }
}

/** Mensagem amigável para falhas de armazenamento. */
export function mensagemErroArmazenamento(e: unknown): string {
  const nome = (e as { name?: string })?.name ?? ''
  if (nome === 'QuotaExceededError' || /quota/i.test(String((e as Error)?.message))) {
    return 'Sem espaço de armazenamento no dispositivo. Exporte um backup e libere espaço.'
  }
  if (nome === 'InvalidStateError' || nome === 'SecurityError' || /indexeddb|database/i.test(String((e as Error)?.message))) {
    return 'O armazenamento do navegador não está disponível (modo privativo ou bloqueado). Os dados não puderam ser salvos.'
  }
  return `Não foi possível salvar: ${(e as Error)?.message ?? 'erro desconhecido'}`
}
