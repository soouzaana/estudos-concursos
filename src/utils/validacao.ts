import type { BlocoQuestoes } from '@/types'
import { dataValida } from './datas'

export interface ResultadoValidacao {
  ok: boolean
  erros: string[]
}

export interface EntradaQuestoes {
  data: string
  concursoIds: string[]
  disciplinaId: string
  total: number
  acertos: number
  fonte?: string
}

const inteiroNaoNegativo = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0

/** Valida um bloco de questões. */
export function validarQuestoes(e: EntradaQuestoes): ResultadoValidacao {
  const erros: string[] = []
  if (!dataValida(e.data)) erros.push('Informe uma data válida.')
  if (!e.disciplinaId) erros.push('Selecione a disciplina.')
  if (!inteiroNaoNegativo(e.total)) erros.push('O total de questões deve ser um número inteiro maior ou igual a zero.')
  else if (e.total === 0) erros.push('Informe ao menos 1 questão.')
  if (!inteiroNaoNegativo(e.acertos)) erros.push('Os acertos devem ser um número inteiro maior ou igual a zero.')
  if (inteiroNaoNegativo(e.total) && inteiroNaoNegativo(e.acertos) && e.acertos > e.total)
    erros.push('Os acertos não podem ser maiores que o total de questões.')
  return { ok: erros.length === 0, erros }
}

/** Erros = total − acertos (nunca negativo). */
export function calcularErros(total: number, acertos: number): number {
  if (!Number.isFinite(total) || !Number.isFinite(acertos)) return 0
  return Math.max(0, total - acertos)
}

/** Aproveitamento em % (0–100). Retorna null quando não há questões (evita divisão por zero). */
export function calcularAproveitamento(acertos: number, total: number): number | null {
  if (!Number.isFinite(total) || total <= 0) return null
  const pct = (acertos / total) * 100
  return Math.min(100, Math.max(0, pct))
}

export function formatarPercentual(p: number | null, casas = 0): string {
  return p === null ? '—' : `${p.toFixed(casas)}%`
}

/** Verifica a consistência de um registro já salvo. */
export function blocoConsistente(b: Pick<BlocoQuestoes, 'total' | 'acertos'>): boolean {
  return inteiroNaoNegativo(b.total) && inteiroNaoNegativo(b.acertos) && b.acertos <= b.total && b.total > 0
}
