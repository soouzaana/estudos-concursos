import type { Cartao, DataISO, ID, RevisaoCartao } from '@/types'
import { ehNovo, estaVencido, venceHoje } from './fsrs'
import { paraDataISO } from '@/utils/datas'

export interface FiltroCartoes {
  concursoId?: ID
  disciplinaId?: ID
  topicoId?: ID
  /** apenas cartões originados do caderno de erros */
  doCaderno?: boolean
  busca?: string
}

export function filtrarCartoes(cartoes: Cartao[], f: FiltroCartoes, incluirArquivados = false): Cartao[] {
  const q = f.busca?.trim().toLowerCase()
  return cartoes.filter((c) => {
    if (!incluirArquivados && c.arquivado) return false
    if (f.concursoId && !c.concursoIds.includes(f.concursoId)) return false
    if (f.disciplinaId && c.disciplinaId !== f.disciplinaId) return false
    if (f.topicoId && c.topicoId !== f.topicoId) return false
    if (f.doCaderno && !c.origemErroId) return false
    if (q && ![c.frente, c.verso, ...c.tags].some((t) => t.toLowerCase().includes(q))) return false
    return true
  })
}

export interface OpcoesFila extends FiltroCartoes {
  /** limite de cartões novos por dia (considera os já iniciados hoje) */
  novosPorDia: number
  /** 'vencidas' = só o que já venceu; 'hoje' = tudo que vence até o fim do dia */
  modo: 'vencidas' | 'hoje'
  agora?: number
}

/** Quantos cartões novos já foram apresentados na data informada. */
export function novosIniciadosHoje(revisoes: RevisaoCartao[], hoje: DataISO): number {
  const ids = new Set<ID>()
  for (const r of revisoes) if (r.data === hoje && r.estadoAnterior === 0) ids.add(r.cartaoId)
  return ids.size
}

/** Fila de revisão: vencidos primeiro (mais antigos antes) e depois novos, respeitando o limite diário de novos. */
export function montarFila(cartoes: Cartao[], revisoes: RevisaoCartao[], o: OpcoesFila): Cartao[] {
  const agora = o.agora ?? Date.now()
  const pertinentes = filtrarCartoes(cartoes, o)
  const criterio = o.modo === 'vencidas' ? (c: Cartao) => estaVencido(c, agora) : (c: Cartao) => venceHoje(c, agora)
  const devidos = pertinentes.filter(criterio)
  const aprendidos = devidos.filter((c) => !ehNovo(c)).sort((a, b) => a.proximaRevisao - b.proximaRevisao)
  const restantes = Math.max(0, o.novosPorDia - novosIniciadosHoje(revisoes, paraDataISO(agora)))
  const novos = devidos.filter(ehNovo).sort((a, b) => a.criadoEm - b.criadoEm).slice(0, restantes)
  return [...aprendidos, ...novos]
}

export interface ContagensCartoes {
  total: number
  vencidas: number
  hoje: number
  novos: number
  doCaderno: number
}

export function contarCartoes(cartoes: Cartao[], agora = Date.now()): ContagensCartoes {
  const ativos = cartoes.filter((c) => !c.arquivado)
  return {
    total: ativos.length,
    vencidas: ativos.filter((c) => estaVencido(c, agora) && !ehNovo(c)).length,
    hoje: ativos.filter((c) => venceHoje(c, agora)).length,
    novos: ativos.filter(ehNovo).length,
    doCaderno: ativos.filter((c) => c.origemErroId).length
  }
}
