/**
 * Repetição espaçada com FSRS (biblioteca `ts-fsrs`, implementação do algoritmo FSRS).
 * Este módulo apenas adapta o estado do algoritmo ao formato persistido no IndexedDB.
 */
import { createEmptyCard, fsrs, generatorParameters, Rating, State, type Card, type Grade } from 'ts-fsrs'
import type { Cartao, EstadoFsrs, NotaRevisao, RevisaoCartao } from '@/types'
import { paraDataISO } from '@/utils/datas'
import { novoId } from '@/utils/id'

export const ALGORITMO = 'FSRS (ts-fsrs)'

const NOTA_PARA_RATING: Record<NotaRevisao, Grade> = {
  errei: Rating.Again,
  dificil: Rating.Hard,
  bom: Rating.Good,
  facil: Rating.Easy
}

export function criarAgendador(retencaoDesejada = 0.9) {
  const r = Math.min(0.99, Math.max(0.7, retencaoDesejada))
  return fsrs(generatorParameters({ request_retention: r, enable_fuzz: false }))
}

function paraCard(e: EstadoFsrs): Card {
  return {
    due: new Date(e.due),
    stability: e.stability,
    difficulty: e.difficulty,
    elapsed_days: e.elapsedDays,
    scheduled_days: e.scheduledDays,
    learning_steps: e.learningSteps,
    reps: e.reps,
    lapses: e.lapses,
    state: e.state as State,
    last_review: e.lastReview ? new Date(e.lastReview) : undefined
  }
}

function deCard(c: Card): EstadoFsrs {
  return {
    due: c.due.getTime(),
    stability: c.stability,
    difficulty: c.difficulty,
    elapsedDays: c.elapsed_days,
    scheduledDays: c.scheduled_days,
    learningSteps: c.learning_steps,
    reps: c.reps,
    lapses: c.lapses,
    state: c.state as number,
    lastReview: c.last_review ? c.last_review.getTime() : undefined
  }
}

export function estadoInicial(agora = Date.now()): EstadoFsrs {
  return deCard(createEmptyCard(new Date(agora)))
}

export interface ResultadoRevisao {
  cartao: Cartao
  revisao: RevisaoCartao
}

/** Aplica a nota ao cartão, devolvendo o cartão atualizado e o registro de revisão. */
export function revisarCartao(cartao: Cartao, nota: NotaRevisao, agora = Date.now(), retencao = 0.9): ResultadoRevisao {
  const f = criarAgendador(retencao)
  const { card, log } = f.next(paraCard(cartao.fsrs), new Date(agora), NOTA_PARA_RATING[nota])
  const novo = deCard(card)
  const intervaloDias = Math.max(0, (novo.due - agora) / 86_400_000)
  return {
    cartao: { ...cartao, fsrs: novo, proximaRevisao: novo.due },
    revisao: {
      id: novoId(),
      cartaoId: cartao.id,
      em: agora,
      data: paraDataISO(agora),
      nota,
      estadoAnterior: log.state as number,
      estadoNovo: novo.state,
      intervaloDias: Math.round(intervaloDias * 100) / 100
    }
  }
}

/** Prévia do próximo intervalo para cada nota (rótulos dos botões). */
export function previaIntervalos(cartao: Cartao, agora = Date.now(), retencao = 0.9): Record<NotaRevisao, string> {
  const f = criarAgendador(retencao)
  const registro = f.repeat(paraCard(cartao.fsrs), new Date(agora))
  const fmt = (due: Date) => formatarIntervalo(due.getTime() - agora)
  return {
    errei: fmt(registro[Rating.Again].card.due),
    dificil: fmt(registro[Rating.Hard].card.due),
    bom: fmt(registro[Rating.Good].card.due),
    facil: fmt(registro[Rating.Easy].card.due)
  }
}

export function formatarIntervalo(ms: number): string {
  const min = ms / 60_000
  if (min < 1) return '<1 min'
  if (min < 60) return `${Math.round(min)} min`
  const h = min / 60
  if (h < 24) return `${Math.round(h)} h`
  const d = h / 24
  if (d < 30) return `${Math.round(d)} d`
  const mes = d / 30
  if (mes < 12) return `${Math.round(mes * 10) / 10} mês`.replace('.', ',')
  return `${Math.round((d / 365) * 10) / 10} ano`.replace('.', ',')
}

/** Fim do dia local (para "vence hoje"). */
export function fimDoDia(agora = Date.now()): number {
  const d = new Date(agora)
  d.setHours(23, 59, 59, 999)
  return d.getTime()
}

export const estaVencido = (c: Cartao, agora = Date.now()) => !c.arquivado && c.proximaRevisao <= agora
export const venceHoje = (c: Cartao, agora = Date.now()) => !c.arquivado && c.proximaRevisao <= fimDoDia(agora)
export const ehNovo = (c: Cartao) => c.fsrs.state === 0 && c.fsrs.reps === 0
