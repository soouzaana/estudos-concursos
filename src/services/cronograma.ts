/**
 * Regras do cronograma (funções puras, sem acesso a banco).
 *
 * - Cada atividade tem data planejada (original), data de reagendamento (opcional) e data de realização.
 * - Pular NÃO conclui: a atividade fica "pulada" para sempre no histórico e a "próxima atividade" passa
 *   para a seguinte da sequência.
 * - Nada avança sozinho por mudança de data: só ações explícitas alteram o status.
 */
import type { Atividade, DataISO, EventoCronograma, ID, Prioridade, Sessao, StatusAtividade } from '@/types'
import { deISO, formatarData, somarDias } from '@/utils/datas'
import { novoId } from '@/utils/id'

export type EventoSemId = Omit<EventoCronograma, 'id' | 'em' | 'atividadeId' | 'concursoId'>
export interface Transicao {
  atividade: Atividade
  evento: EventoSemId
}

export const dataEfetiva = (a: Pick<Atividade, 'dataPlanejada' | 'reagendadaPara'>): DataISO => a.reagendadaPara ?? a.dataPlanejada

export const estaAberta = (a: Pick<Atividade, 'status'>) => a.status === 'pendente' || a.status === 'em_andamento'

export function estaAtrasada(a: Atividade, hoje: DataISO): boolean {
  return estaAberta(a) && dataEfetiva(a) < hoje
}

/** Ordem da sequência: data efetiva, horário (sem horário vai ao fim do dia), ordem manual, criação. */
export function compararAtividades(a: Atividade, b: Atividade): number {
  const da = dataEfetiva(a)
  const db = dataEfetiva(b)
  if (da !== db) return da < db ? -1 : 1
  const ha = a.horario || '99:99'
  const hb = b.horario || '99:99'
  if (ha !== hb) return ha < hb ? -1 : 1
  if (a.ordem !== b.ordem) return a.ordem - b.ordem
  return a.criadoEm - b.criadoEm
}

export const ordenarAtividades = (lista: Atividade[]) => [...lista].sort(compararAtividades)

/**
 * Próxima atividade da sequência: a primeira ainda aberta (pendente/em andamento).
 * Atividades atrasadas continuam sendo a próxima até serem concluídas, puladas ou reagendadas.
 */
export function proximaAtividade(lista: Atividade[], concursoId?: ID): Atividade | undefined {
  return ordenarAtividades(lista.filter((a) => (!concursoId || a.concursoId === concursoId) && estaAberta(a)))[0]
}

export interface ProgressoCronograma {
  total: number
  concluidas: number
  puladas: number
  pendentes: number
  emAndamento: number
  /** Concluídas ÷ total (puladas não contam como concluídas). */
  percentual: number | null
}

export function progressoCronograma(lista: Atividade[]): ProgressoCronograma {
  const c = (s: StatusAtividade) => lista.filter((a) => a.status === s).length
  const total = lista.length
  const concluidas = c('concluida')
  return {
    total,
    concluidas,
    puladas: c('pulada'),
    pendentes: c('pendente'),
    emAndamento: c('em_andamento'),
    percentual: total === 0 ? null : (concluidas / total) * 100
  }
}

export function tempoRealizadoSeg(atividadeId: ID, sessoes: Sessao[]): number {
  return sessoes.filter((s) => s.atividadeId === atividadeId).reduce((t, s) => t + s.duracaoSeg, 0)
}

/* ----------------------------- transições de status ------------------------ */

function copia(a: Atividade, mudancas: Partial<Atividade>, agora: number): Atividade {
  return { ...a, ...mudancas, atualizadoEm: agora }
}

export function iniciarAtividade(a: Atividade, agora = Date.now()): Transicao | null {
  if (a.status !== 'pendente') return null
  return {
    atividade: copia(a, { status: 'em_andamento' }, agora),
    evento: { tipo: 'iniciada', detalhe: 'Atividade iniciada', de: a.status, para: 'em_andamento' }
  }
}

export function concluirAtividade(a: Atividade, hoje: DataISO, agora = Date.now()): Transicao | null {
  if (!estaAberta(a)) return null
  return {
    atividade: copia(a, { status: 'concluida', dataRealizacao: hoje }, agora),
    evento: {
      tipo: 'concluida',
      detalhe: `Concluída em ${formatarData(hoje)} (planejada para ${formatarData(dataEfetiva(a))})`,
      de: a.status,
      para: 'concluida'
    }
  }
}

/** Marca como pulada. Não conclui, não apaga e não define data de realização. */
export function pularAtividade(a: Atividade, agora = Date.now()): Transicao | null {
  if (!estaAberta(a)) return null
  return {
    atividade: copia(a, { status: 'pulada' }, agora),
    evento: { tipo: 'pulada', detalhe: `Pulada (planejada para ${formatarData(dataEfetiva(a))})`, de: a.status, para: 'pulada' }
  }
}

export function reabrirAtividade(a: Atividade, agora = Date.now()): Transicao | null {
  if (a.status !== 'concluida' && a.status !== 'pulada') return null
  const m: Partial<Atividade> = { status: 'pendente' }
  const novo = copia(a, m, agora)
  delete novo.dataRealizacao
  return { atividade: novo, evento: { tipo: 'reaberta', detalhe: 'Atividade reaberta', de: a.status, para: 'pendente' } }
}

/** Reagenda uma atividade aberta. A data planejada original é preservada. */
export function reagendarAtividade(a: Atividade, novaData: DataISO, agora = Date.now()): Transicao | null {
  if (!estaAberta(a)) return null
  const atual = dataEfetiva(a)
  if (novaData === atual) return null
  return {
    atividade: copia(a, { reagendadaPara: novaData }, agora),
    evento: {
      tipo: 'reagendada',
      detalhe: `Reagendada de ${formatarData(atual)} para ${formatarData(novaData)}`,
      de: atual,
      para: novaData
    }
  }
}

/** Ação explícita do usuário: leva todas as atividades abertas e atrasadas para "hoje". */
export function reagendarAtrasadas(lista: Atividade[], hoje: DataISO, agora = Date.now()): Transicao[] {
  return ordenarAtividades(lista.filter((a) => estaAtrasada(a, hoje)))
    .map((a) => reagendarAtividade(a, hoje, agora))
    .filter((t): t is Transicao => t !== null)
}

/* ------------------------------ criação em lote ---------------------------- */

export interface RegraSemanal {
  /** 0 = domingo … 6 = sábado */
  diaSemana: number
  disciplinaId: ID
  topicoId?: ID
  duracaoMin: number
  horario?: string
  questoesPrevistas?: number
  prioridade?: Prioridade
}

export interface ParametrosGeracao {
  concursoId: ID
  dataInicio: DataISO
  semanas: number
  regras: RegraSemanal[]
  ordemInicial: number
}

/** Gera a sequência de atividades de N semanas a partir de regras semanais (ex.: seg → Constitucional). */
export function gerarAtividadesSemanais(p: ParametrosGeracao, agora = Date.now()): Atividade[] {
  const out: Atividade[] = []
  let ordem = p.ordemInicial
  const total = Math.max(0, Math.min(104, Math.floor(p.semanas))) * 7
  for (let i = 0; i < total; i++) {
    const data = somarDias(p.dataInicio, i)
    const dow = deISO(data).getDay()
    for (const r of p.regras.filter((x) => x.diaSemana === dow)) {
      out.push({
        id: novoId(),
        concursoId: p.concursoId,
        disciplinaId: r.disciplinaId,
        topicoId: r.topicoId,
        dataPlanejada: data,
        horario: r.horario || undefined,
        duracaoMin: r.duracaoMin,
        questoesPrevistas: r.questoesPrevistas ?? 0,
        prioridade: r.prioridade ?? 'media',
        status: 'pendente',
        observacoes: '',
        ordem: ordem++,
        criadoEm: agora,
        atualizadoEm: agora
      })
    }
  }
  return out
}
