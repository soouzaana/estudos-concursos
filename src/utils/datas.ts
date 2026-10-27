import type { DataISO } from '@/types'

const pad = (n: number) => String(n).padStart(2, '0')

/** Converte um Date (ou epoch ms) para "YYYY-MM-DD" no fuso local. */
export function paraDataISO(d: Date | number = new Date()): DataISO {
  const dt = typeof d === 'number' ? new Date(d) : d
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`
}

export function hoje(): DataISO {
  return paraDataISO(new Date())
}

/** Interpreta "YYYY-MM-DD" como data local ao meio-dia (evita saltos de DST). */
export function deISO(s: DataISO): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0)
}

export function dataValida(s: unknown): s is DataISO {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const d = deISO(s)
  return paraDataISO(d) === s
}

export function somarDias(s: DataISO, dias: number): DataISO {
  const d = deISO(s)
  d.setDate(d.getDate() + dias)
  return paraDataISO(d)
}

export function diffDias(a: DataISO, b: DataISO): number {
  return Math.round((deISO(a).getTime() - deISO(b).getTime()) / 86_400_000)
}

/** Início da semana (domingo) para a data. */
export function inicioSemana(s: DataISO): DataISO {
  const d = deISO(s)
  return somarDias(s, -d.getDay())
}

export function fimSemana(s: DataISO): DataISO {
  return somarDias(inicioSemana(s), 6)
}

export function inicioMes(s: DataISO): DataISO {
  return s.slice(0, 8) + '01'
}

export function fimMes(s: DataISO): DataISO {
  const d = deISO(s)
  return paraDataISO(new Date(d.getFullYear(), d.getMonth() + 1, 0, 12))
}

export function somarMeses(s: DataISO, n: number): DataISO {
  const d = deISO(inicioMes(s))
  d.setMonth(d.getMonth() + n)
  return paraDataISO(d)
}

export function intervaloDias(ini: DataISO, fim: DataISO): DataISO[] {
  const out: DataISO[] = []
  if (ini > fim) return out
  let cur = ini
  let guard = 0
  while (cur <= fim && guard++ < 4000) {
    out.push(cur)
    cur = somarDias(cur, 1)
  }
  return out
}

const DIAS_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const DIAS_LONGOS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

export const diaSemanaCurto = (s: DataISO) => DIAS_CURTOS[deISO(s).getDay()]
export const diaSemanaLongo = (s: DataISO) => DIAS_LONGOS[deISO(s).getDay()]
export const nomeMes = (s: DataISO) => MESES[deISO(s).getMonth()]
export const nomesDiasCurtos = () => [...DIAS_CURTOS]

export function formatarData(s?: DataISO): string {
  if (!s) return '—'
  const [y, m, d] = s.split('-')
  return `${d}/${m}/${y}`
}

export function formatarDataCurta(s: DataISO): string {
  const [, m, d] = s.split('-')
  return `${d}/${m}`
}

export function formatarDataExtenso(s: DataISO): string {
  const d = deISO(s)
  return `${DIAS_LONGOS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`
}

export function formatarMesAno(s: DataISO): string {
  const d = deISO(s)
  return `${MESES[d.getMonth()]} de ${d.getFullYear()}`
}

export function formatarHora(ms: number): string {
  const d = new Date(ms)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** "2h 05min" a partir de segundos. */
export function formatarDuracao(seg: number): string {
  const total = Math.max(0, Math.round(seg))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  if (h === 0) return `${m} min`
  return `${h}h ${pad(m)}min`
}

export function formatarCronometro(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}

export const horasDeSeg = (seg: number) => seg / 3600
