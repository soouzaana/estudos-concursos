import type { Configuracoes, MetaVigente, ModoTema, PaletaTema, ComportamentoAtrasadas } from '@/types'

export const PALETAS: { valor: PaletaTema; rotulo: string; cor: string }[] = [
  { valor: 'roxo', rotulo: 'Roxo', cor: '#7c3aed' },
  { valor: 'rosa', rotulo: 'Rosa', cor: '#db2777' },
  { valor: 'azul', rotulo: 'Azul', cor: '#2563eb' },
  { valor: 'verde', rotulo: 'Verde', cor: '#059669' },
  { valor: 'lilas', rotulo: 'Lilás', cor: '#a78bfa' },
  { valor: 'neutro', rotulo: 'Neutro', cor: '#52525b' }
]

const MODOS: ModoTema[] = ['claro', 'escuro', 'automatico']
const ATRASADAS: ComportamentoAtrasadas[] = ['manter', 'oferecer_reagendar']

export function configPadrao(): Configuracoes {
  return {
    modo: 'automatico',
    paleta: 'roxo',
    corPersonalizada: '#7c3aed',
    metas: [{ desde: '0000-01-01', metaDiariaMin: 120, metaSemanalMin: 600, metaQuestoesDia: 20 }],
    diasDisponiveis: [1, 2, 3, 4, 5, 6],
    horariosPreferidos: '',
    tempoPadraoSessaoMin: 50,
    intervaloMin: 10,
    atrasadas: 'manter',
    novosCartoesPorDia: 20,
    retencaoDesejada: 0.9,
    duracaoPadraoAtividadeMin: 60
  }
}

const num = (v: unknown, padrao: number, min = 0, max = Number.POSITIVE_INFINITY) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : padrao

/** Normaliza (e valida) um objeto de configurações vindo do disco ou de um backup. */
export function normalizarConfiguracoes(raw: unknown): Configuracoes {
  const p = configPadrao()
  if (!raw || typeof raw !== 'object') return p
  const r = raw as Record<string, unknown>
  const metas: MetaVigente[] = Array.isArray(r.metas)
    ? (r.metas as unknown[])
        .filter((m): m is Record<string, unknown> => !!m && typeof m === 'object')
        .map((m) => ({
          desde: typeof m.desde === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(m.desde) ? m.desde : '0000-01-01',
          metaDiariaMin: num(m.metaDiariaMin, 0),
          metaSemanalMin: num(m.metaSemanalMin, 0),
          metaQuestoesDia: num(m.metaQuestoesDia, 0)
        }))
    : []
  const paletasValidas = [...PALETAS.map((x) => x.valor), 'personalizada']
  return {
    modo: MODOS.includes(r.modo as ModoTema) ? (r.modo as ModoTema) : p.modo,
    paleta: paletasValidas.includes(r.paleta as string) ? (r.paleta as PaletaTema) : p.paleta,
    corPersonalizada: typeof r.corPersonalizada === 'string' && /^#[0-9a-fA-F]{6}$/.test(r.corPersonalizada) ? r.corPersonalizada : p.corPersonalizada,
    metas: metas.length ? metas : p.metas,
    diasDisponiveis: Array.isArray(r.diasDisponiveis)
      ? (r.diasDisponiveis as unknown[]).filter((n): n is number => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= 6)
      : p.diasDisponiveis,
    horariosPreferidos: typeof r.horariosPreferidos === 'string' ? r.horariosPreferidos : p.horariosPreferidos,
    tempoPadraoSessaoMin: num(r.tempoPadraoSessaoMin, p.tempoPadraoSessaoMin, 1, 600),
    intervaloMin: num(r.intervaloMin, p.intervaloMin, 0, 240),
    atrasadas: ATRASADAS.includes(r.atrasadas as ComportamentoAtrasadas) ? (r.atrasadas as ComportamentoAtrasadas) : p.atrasadas,
    novosCartoesPorDia: num(r.novosCartoesPorDia, p.novosCartoesPorDia, 0, 500),
    retencaoDesejada: num(r.retencaoDesejada, p.retencaoDesejada, 0.7, 0.99),
    duracaoPadraoAtividadeMin: num(r.duracaoPadraoAtividadeMin, p.duracaoPadraoAtividadeMin, 5, 600)
  }
}

/**
 * Altera as metas a partir de uma data, sem mexer no que já foi registrado:
 * a meta antiga continua valendo para datas anteriores.
 */
export function aplicarNovaMeta(metas: MetaVigente[], nova: MetaVigente): MetaVigente[] {
  const semMesmaData = metas.filter((m) => m.desde !== nova.desde)
  return [...semMesmaData, nova].sort((a, b) => (a.desde < b.desde ? -1 : 1))
}
