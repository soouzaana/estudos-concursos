/**
 * Cronômetro baseado em timestamps. O tempo NUNCA é acumulado por um contador de interface:
 * é sempre recalculado a partir de instantes gravados (iniciadoEm / retomadoEm / acumuladoMs),
 * o que permite recuperar o estado após recarregar a página ou voltar do segundo plano.
 */
import type { DataISO, EstadoCronometro, MetodoEstudo, Sessao } from '@/types'
import { paraDataISO } from '@/utils/datas'
import { novoId } from '@/utils/id'

export interface ParametrosInicio {
  concursoId?: string
  disciplinaId?: string
  topicoId?: string
  atividadeId?: string
  metodo?: MetodoEstudo
  observacoes?: string
}

export function iniciarCronometro(p: ParametrosInicio, agora = Date.now()): EstadoCronometro {
  return {
    concursoId: p.concursoId,
    disciplinaId: p.disciplinaId,
    topicoId: p.topicoId,
    atividadeId: p.atividadeId,
    metodo: p.metodo ?? 'teoria',
    observacoes: p.observacoes ?? '',
    iniciadoEm: agora,
    status: 'rodando',
    acumuladoMs: 0,
    retomadoEm: agora
  }
}

/** Tempo efetivamente decorrido (ms). Relógio que volta no tempo nunca gera tempo negativo. */
export function tempoDecorridoMs(e: EstadoCronometro, agora = Date.now()): number {
  const extra = e.status === 'rodando' ? Math.max(0, agora - e.retomadoEm) : 0
  return e.acumuladoMs + extra
}

export function pausarCronometro(e: EstadoCronometro, agora = Date.now()): EstadoCronometro {
  if (e.status !== 'rodando') return e
  return { ...e, status: 'pausado', acumuladoMs: tempoDecorridoMs(e, agora), retomadoEm: agora }
}

export function continuarCronometro(e: EstadoCronometro, agora = Date.now()): EstadoCronometro {
  if (e.status !== 'pausado') return e
  return { ...e, status: 'rodando', retomadoEm: agora }
}

/** Converte o cronômetro em sessão. Retorna null se nenhum segundo foi estudado. */
export function finalizarCronometro(
  e: EstadoCronometro,
  agora = Date.now(),
  duracaoSegEditada?: number
): Sessao | null {
  const decorridoSeg = Math.round(tempoDecorridoMs(e, agora) / 1000)
  const duracaoSeg = duracaoSegEditada !== undefined ? Math.max(0, Math.round(duracaoSegEditada)) : decorridoSeg
  if (duracaoSeg <= 0) return null
  return {
    id: novoId(),
    concursoId: e.concursoId,
    disciplinaId: e.disciplinaId,
    topicoId: e.topicoId,
    atividadeId: e.atividadeId,
    data: paraDataISO(e.iniciadoEm),
    inicio: e.iniciadoEm,
    fim: Math.max(agora, e.iniciadoEm),
    duracaoSeg,
    metodo: e.metodo,
    observacoes: e.observacoes,
    manual: false,
    criadoEm: agora
  }
}

export interface EntradaSessaoManual {
  data: DataISO
  /** HH:mm */
  inicio: string
  /** HH:mm — o término é derivado de início + duração quando omitido */
  fim?: string
  duracaoMin: number
  concursoId?: string
  disciplinaId?: string
  topicoId?: string
  atividadeId?: string
  metodo: MetodoEstudo
  observacoes?: string
}

export function validarSessaoManual(e: EntradaSessaoManual): string[] {
  const erros: string[] = []
  if (!/^\d{4}-\d{2}-\d{2}$/.test(e.data)) erros.push('Informe uma data válida.')
  if (!/^\d{2}:\d{2}$/.test(e.inicio)) erros.push('Informe o horário de início.')
  if (!Number.isFinite(e.duracaoMin) || e.duracaoMin <= 0) erros.push('A duração deve ser maior que zero.')
  if (e.duracaoMin > 24 * 60) erros.push('A duração não pode passar de 24 horas.')
  return erros
}

export function criarSessaoManual(e: EntradaSessaoManual, agora = Date.now()): Sessao {
  const [h, m] = e.inicio.split(':').map(Number)
  const [y, mo, d] = e.data.split('-').map(Number)
  const inicio = new Date(y, mo - 1, d, h, m, 0, 0).getTime()
  const duracaoSeg = Math.round(e.duracaoMin * 60)
  return {
    id: novoId(),
    concursoId: e.concursoId || undefined,
    disciplinaId: e.disciplinaId || undefined,
    topicoId: e.topicoId || undefined,
    atividadeId: e.atividadeId || undefined,
    data: e.data,
    inicio,
    fim: inicio + duracaoSeg * 1000,
    duracaoSeg,
    metodo: e.metodo,
    observacoes: e.observacoes ?? '',
    manual: true,
    criadoEm: agora
  }
}
