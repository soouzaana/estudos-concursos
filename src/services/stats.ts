/**
 * Estatísticas e relatórios (funções puras).
 *
 * Regras de não-duplicação:
 *  - Sessões pertencem a no máximo um concurso → somas globais nunca contam o mesmo tempo duas vezes.
 *  - Blocos de questões podem estar associados a vários concursos: no total geral cada bloco entra UMA vez;
 *    na visão de um concurso específico o bloco aparece (é dele também). Por isso a soma das visões por
 *    concurso pode ser maior que o total geral — isso é esperado e documentado na interface.
 */
import type {
  Atividade,
  BlocoQuestoes,
  Concurso,
  ConcursoDisciplina,
  Configuracoes,
  DataISO,
  Disciplina,
  Erro,
  ID,
  MarcacaoDia,
  MetaVigente,
  RevisaoCartao,
  Cartao,
  Sessao,
  Topico
} from '@/types'
import { dataEfetiva } from './cronograma'
import { calcularAproveitamento, calcularErros } from '@/utils/validacao'
import {
  deISO,
  diffDias,
  formatarData,
  formatarDataCurta,
  inicioMes,
  inicioSemana,
  intervaloDias,
  nomeMes,
  paraDataISO,
  somarDias
} from '@/utils/datas'

export interface DadosStats {
  concursos: Concurso[]
  disciplinas: Disciplina[]
  concursoDisciplinas: ConcursoDisciplina[]
  topicos: Topico[]
  atividades: Atividade[]
  sessoes: Sessao[]
  questoes: BlocoQuestoes[]
  erros: Erro[]
  cartoes: Cartao[]
  revisoesCartao: RevisaoCartao[]
  marcacoesDia: MarcacaoDia[]
}

export interface FiltroStats {
  de: DataISO
  ate: DataISO
  concursoId?: ID
  disciplinaId?: ID
}

export type ConfigStats = Pick<Configuracoes, 'diasDisponiveis' | 'metas'>

/* -------------------------------- metas ---------------------------------- */

/** Meta em vigor numa data. Alterações de meta só valem a partir da data em que foram feitas. */
export function metaVigente(metas: MetaVigente[], data: DataISO): MetaVigente {
  const ordenadas = [...metas].sort((a, b) => (a.desde < b.desde ? -1 : 1))
  let escolhida: MetaVigente | undefined
  for (const m of ordenadas) if (m.desde <= data) escolhida = m
  return escolhida ?? ordenadas[0] ?? { desde: '0000-01-01', metaDiariaMin: 0, metaSemanalMin: 0, metaQuestoesDia: 0 }
}

/* ------------------------------ filtros básicos --------------------------- */

const noPeriodo = (data: DataISO, f: FiltroStats) => data >= f.de && data <= f.ate

export function sessoesFiltradas(d: Pick<DadosStats, 'sessoes'>, f: FiltroStats): Sessao[] {
  return d.sessoes.filter(
    (s) =>
      noPeriodo(s.data, f) &&
      (!f.concursoId || s.concursoId === f.concursoId) &&
      (!f.disciplinaId || s.disciplinaId === f.disciplinaId)
  )
}

export function questoesFiltradas(d: Pick<DadosStats, 'questoes'>, f: FiltroStats): BlocoQuestoes[] {
  return d.questoes.filter(
    (b) =>
      noPeriodo(b.data, f) &&
      (!f.concursoId || b.concursoIds.includes(f.concursoId)) &&
      (!f.disciplinaId || b.disciplinaId === f.disciplinaId)
  )
}

export function atividadesFiltradas(d: Pick<DadosStats, 'atividades'>, f: FiltroStats): Atividade[] {
  return d.atividades.filter(
    (a) =>
      noPeriodo(dataEfetiva(a), f) &&
      (!f.concursoId || a.concursoId === f.concursoId) &&
      (!f.disciplinaId || a.disciplinaId === f.disciplinaId)
  )
}

function revisoesFiltradas(d: Pick<DadosStats, 'revisoesCartao' | 'cartoes'>, f: FiltroStats): RevisaoCartao[] {
  const porId = new Map(d.cartoes.map((c) => [c.id, c]))
  return d.revisoesCartao.filter((r) => {
    if (!noPeriodo(r.data, f)) return false
    const c = porId.get(r.cartaoId)
    if (!c) return !f.concursoId && !f.disciplinaId
    if (f.concursoId && !c.concursoIds.includes(f.concursoId)) return false
    if (f.disciplinaId && c.disciplinaId !== f.disciplinaId) return false
    return true
  })
}

export interface TotaisQuestoes {
  total: number
  acertos: number
  erros: number
  aproveitamento: number | null
}

export function totaisQuestoes(blocos: BlocoQuestoes[]): TotaisQuestoes {
  const total = blocos.reduce((t, b) => t + b.total, 0)
  const acertos = blocos.reduce((t, b) => t + b.acertos, 0)
  return { total, acertos, erros: calcularErros(total, acertos), aproveitamento: calcularAproveitamento(acertos, total) }
}

export const totalSegundos = (ss: Sessao[]) => ss.reduce((t, s) => t + s.duracaoSeg, 0)

/* ------------------------------ classificação de dias ---------------------- */

export type StatusDia = 'concluido' | 'parcial' | 'pulado' | 'sem_registro' | 'futuro'

export interface ContextoDias {
  hoje: DataISO
  segPorDia: Map<DataISO, number>
  questoesPorDia: Map<DataISO, number>
  revisoesPorDia: Map<DataISO, number>
  /** atividades pelo dia em que estavam previstas (data efetiva) */
  previstasPorDia: Map<DataISO, Atividade[]>
  concluidasPorDia: Map<DataISO, number>
  marcacoes: Set<DataISO>
  metas: MetaVigente[]
}

function somarMapa<T>(m: Map<DataISO, T[]>, k: DataISO, v: T) {
  const arr = m.get(k)
  if (arr) arr.push(v)
  else m.set(k, [v])
}

/** Constrói o contexto para classificar dias, ignorando o período (cobre todo o histórico filtrado). */
export function construirContextoDias(d: DadosStats, f: Pick<FiltroStats, 'concursoId' | 'disciplinaId'>, cfg: ConfigStats, hoje: DataISO): ContextoDias {
  const amplo: FiltroStats = { ...f, de: '0000-01-01', ate: '9999-12-31' }
  const segPorDia = new Map<DataISO, number>()
  for (const s of sessoesFiltradas(d, amplo)) segPorDia.set(s.data, (segPorDia.get(s.data) ?? 0) + s.duracaoSeg)
  const questoesPorDia = new Map<DataISO, number>()
  for (const b of questoesFiltradas(d, amplo)) questoesPorDia.set(b.data, (questoesPorDia.get(b.data) ?? 0) + b.total)
  const revisoesPorDia = new Map<DataISO, number>()
  for (const r of revisoesFiltradas(d, amplo)) revisoesPorDia.set(r.data, (revisoesPorDia.get(r.data) ?? 0) + 1)
  const previstasPorDia = new Map<DataISO, Atividade[]>()
  const concluidasPorDia = new Map<DataISO, number>()
  for (const a of atividadesFiltradas(d, amplo)) somarMapa(previstasPorDia, dataEfetiva(a), a)
  for (const a of d.atividades) {
    if (a.status !== 'concluida' || !a.dataRealizacao) continue
    if (f.concursoId && a.concursoId !== f.concursoId) continue
    if (f.disciplinaId && a.disciplinaId !== f.disciplinaId) continue
    concluidasPorDia.set(a.dataRealizacao, (concluidasPorDia.get(a.dataRealizacao) ?? 0) + 1)
  }
  const marcacoes = new Set<DataISO>(d.marcacoesDia.filter((m) => m.tipo === 'pulado').map((m) => m.data))
  return { hoje, segPorDia, questoesPorDia, revisoesPorDia, previstasPorDia, concluidasPorDia, marcacoes, metas: cfg.metas }
}

/**
 * Classifica um dia:
 *  - futuro: depois de hoje;
 *  - pulado: marcado explicitamente (ou só tem atividades puladas) e SEM nenhum registro de estudo;
 *  - sem_registro: nada registrado (nunca é tratado como "pulado" automaticamente);
 *  - concluido: bateu a meta diária de tempo ou concluiu o que estava previsto (sem pendências);
 *  - parcial: há registro de estudo, mas sem cumprir o acima.
 */
export function classificarDia(data: DataISO, ctx: ContextoDias): StatusDia {
  if (data > ctx.hoje) return 'futuro'
  const seg = ctx.segPorDia.get(data) ?? 0
  const questoes = ctx.questoesPorDia.get(data) ?? 0
  const revisoes = ctx.revisoesPorDia.get(data) ?? 0
  const concluidas = ctx.concluidasPorDia.get(data) ?? 0
  const temRegistro = seg > 0 || questoes > 0 || revisoes > 0 || concluidas > 0
  const previstas = ctx.previstasPorDia.get(data) ?? []
  const puladas = previstas.filter((a) => a.status === 'pulada').length
  if (!temRegistro) {
    if (ctx.marcacoes.has(data) || puladas > 0) return 'pulado'
    return 'sem_registro'
  }
  const metaMin = metaVigente(ctx.metas, data).metaDiariaMin
  if (metaMin > 0 && seg >= metaMin * 60) return 'concluido'
  const abertas = previstas.filter((a) => a.status === 'pendente' || a.status === 'em_andamento').length
  const feitas = previstas.filter((a) => a.status === 'concluida').length
  if (feitas > 0 && abertas === 0) return 'concluido'
  return 'parcial'
}

/* --------------------------------- indicadores ---------------------------- */

export interface Indicadores {
  segundos: number
  horas: number
  diasNoPeriodo: number
  diasDecorridos: number
  diasEstudados: number
  diasPulados: number
  mediaDiariaSeg: number
  diasPrevistos: number
  diasPrevistosEstudados: number
  consistencia: number | null
  questoes: TotaisQuestoes
  errosPendentes: number
  flashcardsRevisados: number
  revisoesVencidas: number
  metaSegundos: number | null
  metaQuestoes: number | null
}

export function diasDisponiveisNoIntervalo(de: DataISO, ate: DataISO, disponiveis: number[]): DataISO[] {
  return intervaloDias(de, ate).filter((dia) => disponiveis.includes(deISO(dia).getDay()))
}

export function calcularIndicadores(d: DadosStats, f: FiltroStats, cfg: ConfigStats, hoje: DataISO, agora = Date.now()): Indicadores {
  const ss = sessoesFiltradas(d, f)
  const segundos = totalSegundos(ss)
  const questoes = totaisQuestoes(questoesFiltradas(d, f))
  const ctx = construirContextoDias(d, f, cfg, hoje)
  const todos = intervaloDias(f.de, f.ate)
  const decorridos = todos.filter((dia) => dia <= hoje)
  let diasEstudados = 0
  let diasPulados = 0
  for (const dia of decorridos) {
    const st = classificarDia(dia, ctx)
    if (st === 'concluido' || st === 'parcial') diasEstudados++
    else if (st === 'pulado') diasPulados++
  }
  const previstos = decorridos.filter((dia) => cfg.diasDisponiveis.includes(deISO(dia).getDay()))
  const previstosEstudados = previstos.filter((dia) => {
    const st = classificarDia(dia, ctx)
    return st === 'concluido' || st === 'parcial'
  }).length
  const errosPendentes = d.erros.filter(
    (e) =>
      !e.arquivado &&
      e.statusRevisao === 'pendente' &&
      (!f.concursoId || e.concursoIds.includes(f.concursoId)) &&
      (!f.disciplinaId || e.disciplinaId === f.disciplinaId)
  ).length
  const revisoesVencidas = d.cartoes.filter(
    (c) =>
      !c.arquivado &&
      c.proximaRevisao <= agora &&
      (!f.concursoId || c.concursoIds.includes(f.concursoId)) &&
      (!f.disciplinaId || c.disciplinaId === f.disciplinaId)
  ).length
  const metaSeg = previstos.reduce((t, dia) => t + metaVigente(cfg.metas, dia).metaDiariaMin * 60, 0)
  const metaQ = previstos.reduce((t, dia) => t + metaVigente(cfg.metas, dia).metaQuestoesDia, 0)
  return {
    segundos,
    horas: segundos / 3600,
    diasNoPeriodo: todos.length,
    diasDecorridos: decorridos.length,
    diasEstudados,
    diasPulados,
    mediaDiariaSeg: decorridos.length ? segundos / decorridos.length : 0,
    diasPrevistos: previstos.length,
    diasPrevistosEstudados: previstosEstudados,
    consistencia: previstos.length ? Math.min(100, (previstosEstudados / previstos.length) * 100) : null,
    questoes,
    errosPendentes,
    flashcardsRevisados: revisoesFiltradas(d, f).length,
    revisoesVencidas,
    metaSegundos: metaSeg > 0 ? metaSeg : null,
    metaQuestoes: metaQ > 0 ? metaQ : null
  }
}

/* -------------------------------- séries ---------------------------------- */

export type Agrupamento = 'dia' | 'semana' | 'mes'

export function agrupamentoAutomatico(de: DataISO, ate: DataISO): Agrupamento {
  const n = diffDias(ate, de) + 1
  if (n <= 31) return 'dia'
  if (n <= 140) return 'semana'
  return 'mes'
}

export function chaveBucket(data: DataISO, a: Agrupamento): DataISO {
  if (a === 'dia') return data
  if (a === 'semana') return inicioSemana(data)
  return inicioMes(data)
}

export function rotuloBucket(chave: DataISO, a: Agrupamento): string {
  if (a === 'dia') return formatarDataCurta(chave)
  if (a === 'semana') return `Sem ${formatarDataCurta(chave)}`
  return `${nomeMes(chave).slice(0, 3)}/${chave.slice(2, 4)}`
}

function chavesDoIntervalo(de: DataISO, ate: DataISO, a: Agrupamento): DataISO[] {
  const set: DataISO[] = []
  for (const dia of intervaloDias(de, ate)) {
    const k = chaveBucket(dia, a)
    if (set[set.length - 1] !== k && !set.includes(k)) set.push(k)
  }
  return set
}

export interface PontoSerie {
  chave: DataISO
  rotulo: string
  valor: number
}

export function horasPorPeriodo(d: DadosStats, f: FiltroStats, a: Agrupamento = agrupamentoAutomatico(f.de, f.ate)): PontoSerie[] {
  const acc = new Map<DataISO, number>()
  for (const s of sessoesFiltradas(d, f)) acc.set(chaveBucket(s.data, a), (acc.get(chaveBucket(s.data, a)) ?? 0) + s.duracaoSeg)
  return chavesDoIntervalo(f.de, f.ate, a).map((k) => ({ chave: k, rotulo: rotuloBucket(k, a), valor: (acc.get(k) ?? 0) / 3600 }))
}

export interface PontoQuestoes extends PontoSerie {
  acertos: number
  erros: number
  total: number
  aproveitamento: number | null
}

export function questoesPorPeriodo(d: DadosStats, f: FiltroStats, a: Agrupamento = agrupamentoAutomatico(f.de, f.ate)): PontoQuestoes[] {
  const acc = new Map<DataISO, BlocoQuestoes[]>()
  for (const b of questoesFiltradas(d, f)) somarMapa(acc, chaveBucket(b.data, a), b)
  return chavesDoIntervalo(f.de, f.ate, a).map((k) => {
    const t = totaisQuestoes(acc.get(k) ?? [])
    return { chave: k, rotulo: rotuloBucket(k, a), valor: t.total, acertos: t.acertos, erros: t.erros, total: t.total, aproveitamento: t.aproveitamento }
  })
}

export interface DesempenhoDisciplina {
  disciplinaId: ID | null
  nome: string
  segundos: number
  total: number
  acertos: number
  erros: number
  aproveitamento: number | null
  errosCaderno: number
}

export function desempenhoPorDisciplina(d: DadosStats, f: FiltroStats): DesempenhoDisciplina[] {
  const nomes = new Map(d.disciplinas.map((x) => [x.id, x.nome]))
  const mapa = new Map<ID | null, { ss: Sessao[]; bs: BlocoQuestoes[]; ec: number }>()
  const obter = (id: ID | null) => {
    let v = mapa.get(id)
    if (!v) mapa.set(id, (v = { ss: [], bs: [], ec: 0 }))
    return v
  }
  for (const s of sessoesFiltradas(d, { ...f, disciplinaId: undefined })) {
    if (f.disciplinaId && s.disciplinaId !== f.disciplinaId) continue
    obter(s.disciplinaId ?? null).ss.push(s)
  }
  for (const b of questoesFiltradas(d, { ...f, disciplinaId: undefined })) {
    if (f.disciplinaId && b.disciplinaId !== f.disciplinaId) continue
    obter(b.disciplinaId).bs.push(b)
  }
  for (const e of d.erros) {
    if (e.arquivado || !noPeriodo(e.data, f)) continue
    if (f.concursoId && !e.concursoIds.includes(f.concursoId)) continue
    if (f.disciplinaId && e.disciplinaId !== f.disciplinaId) continue
    obter(e.disciplinaId).ec++
  }
  return [...mapa.entries()]
    .map(([id, v]) => {
      const t = totaisQuestoes(v.bs)
      return {
        disciplinaId: id,
        nome: id ? (nomes.get(id) ?? 'Disciplina removida') : 'Sem disciplina',
        segundos: totalSegundos(v.ss),
        total: t.total,
        acertos: t.acertos,
        erros: t.erros,
        aproveitamento: t.aproveitamento,
        errosCaderno: v.ec
      }
    })
    .sort((a, b) => b.segundos - a.segundos || b.total - a.total)
}

export interface DesempenhoTopico {
  topicoId: ID
  nome: string
  disciplina: string
  total: number
  acertos: number
  aproveitamento: number | null
  errosCaderno: number
}

/** Tópicos com pior aproveitamento (exige amostra mínima para não concluir com poucos dados). */
export function topicosMaisDificeis(d: DadosStats, f: FiltroStats, minimoQuestoes = 5, limite = 5): DesempenhoTopico[] {
  const topicos = new Map(d.topicos.map((t) => [t.id, t]))
  const disc = new Map(d.disciplinas.map((x) => [x.id, x.nome]))
  const acc = new Map<ID, { bs: BlocoQuestoes[]; ec: number }>()
  const obter = (id: ID) => {
    let v = acc.get(id)
    if (!v) acc.set(id, (v = { bs: [], ec: 0 }))
    return v
  }
  for (const b of questoesFiltradas(d, f)) if (b.topicoId) obter(b.topicoId).bs.push(b)
  for (const e of d.erros) {
    if (e.arquivado || !e.topicoId || !noPeriodo(e.data, f)) continue
    if (f.concursoId && !e.concursoIds.includes(f.concursoId)) continue
    if (f.disciplinaId && e.disciplinaId !== f.disciplinaId) continue
    obter(e.topicoId).ec++
  }
  return [...acc.entries()]
    .map(([id, v]) => {
      const t = totaisQuestoes(v.bs)
      const tp = topicos.get(id)
      return {
        topicoId: id,
        nome: tp?.nome ?? 'Tópico removido',
        disciplina: tp ? (disc.get(tp.disciplinaId) ?? '—') : '—',
        total: t.total,
        acertos: t.acertos,
        aproveitamento: t.aproveitamento,
        errosCaderno: v.ec
      }
    })
    .filter((t) => t.total >= minimoQuestoes && t.aproveitamento !== null)
    .sort((a, b) => (a.aproveitamento as number) - (b.aproveitamento as number) || b.errosCaderno - a.errosCaderno)
    .slice(0, limite)
}

export interface PontoConsistencia {
  chave: DataISO
  rotulo: string
  estudados: number
  previstos: number
  percentual: number | null
  /** O período ainda não terminou (inclui dias futuros). */
  parcial: boolean
}

export function consistenciaPorPeriodo(
  d: DadosStats,
  f: FiltroStats,
  cfg: ConfigStats,
  hoje: DataISO,
  a: 'semana' | 'mes'
): PontoConsistencia[] {
  const ctx = construirContextoDias(d, f, cfg, hoje)
  const grupos = new Map<DataISO, DataISO[]>()
  for (const dia of intervaloDias(f.de, f.ate)) somarMapa(grupos, chaveBucket(dia, a), dia)
  return [...grupos.entries()].map(([k, dias]) => {
    const previstos = dias.filter((x) => x <= hoje && cfg.diasDisponiveis.includes(deISO(x).getDay()))
    const estudados = previstos.filter((x) => {
      const s = classificarDia(x, ctx)
      return s === 'concluido' || s === 'parcial'
    }).length
    const fimBucket = a === 'semana' ? somarDias(k, 6) : paraDataISO(new Date(deISO(k).getFullYear(), deISO(k).getMonth() + 1, 0, 12))
    return {
      chave: k,
      rotulo: rotuloBucket(k, a),
      estudados,
      previstos: previstos.length,
      percentual: previstos.length ? (estudados / previstos.length) * 100 : null,
      parcial: fimBucket > hoje || dias.length < (a === 'semana' ? 7 : 28)
    }
  })
}

/* ----------------------------- comparação de períodos ---------------------- */

export interface PeriodosComparaveis {
  atual: FiltroStats
  anterior: FiltroStats
  /** Verdadeiro quando o período escolhido ainda não terminou: ambos são cortados no mesmo nº de dias. */
  parcial: boolean
  dias: number
}

export function periodosComparaveis(f: FiltroStats, hoje: DataISO): PeriodosComparaveis | null {
  const comprimento = diffDias(f.ate, f.de) + 1
  if (comprimento <= 0 || f.de > hoje) return null
  const parcial = f.ate > hoje
  const dias = parcial ? diffDias(hoje, f.de) + 1 : comprimento
  const atual: FiltroStats = { ...f, ate: parcial ? hoje : f.ate }
  const antDe = somarDias(f.de, -comprimento)
  const anterior: FiltroStats = { ...f, de: antDe, ate: somarDias(antDe, dias - 1) }
  return { atual, anterior, parcial, dias }
}

export interface LinhaComparacao {
  disciplinaId: ID | null
  nome: string
  atual: DesempenhoDisciplina | null
  anterior: DesempenhoDisciplina | null
  deltaSegundos: number
  deltaAproveitamento: number | null
}

export function compararDisciplinas(d: DadosStats, p: PeriodosComparaveis): LinhaComparacao[] {
  const a = desempenhoPorDisciplina(d, p.atual)
  const b = desempenhoPorDisciplina(d, p.anterior)
  const ids = new Set<ID | null>([...a.map((x) => x.disciplinaId), ...b.map((x) => x.disciplinaId)])
  return [...ids].map((id) => {
    const ra = a.find((x) => x.disciplinaId === id) ?? null
    const rb = b.find((x) => x.disciplinaId === id) ?? null
    const pa = ra?.aproveitamento ?? null
    const pb = rb?.aproveitamento ?? null
    return {
      disciplinaId: id,
      nome: ra?.nome ?? rb?.nome ?? '—',
      atual: ra,
      anterior: rb,
      deltaSegundos: (ra?.segundos ?? 0) - (rb?.segundos ?? 0),
      deltaAproveitamento: pa !== null && pb !== null ? pa - pb : null
    }
  })
}

/* ------------------------------ análise por dados -------------------------- */

export interface Insight {
  id: string
  tipo: 'baixo_aproveitamento' | 'negligenciada' | 'queda' | 'melhora' | 'revisoes' | 'metas'
  tom: 'atencao' | 'positivo' | 'neutro'
  titulo: string
  /** Frase curta com os números que sustentam o indicador. */
  detalhe: string
}

export const LIMITE_BAIXO_APROVEITAMENTO = 60
export const MINIMO_QUESTOES_ANALISE = 10
export const VARIACAO_RELEVANTE_PP = 5
export const DIAS_NEGLIGENCIADA = 14

const fmtH = (seg: number) => `${(seg / 3600).toFixed(1).replace('.', ',')} h`
const fmtP = (p: number | null) => (p === null ? '—' : `${p.toFixed(0)}%`)

export function gerarInsights(d: DadosStats, f: FiltroStats, cfg: ConfigStats, hoje: DataISO, agora = Date.now()): Insight[] {
  const out: Insight[] = []
  const desempenho = desempenhoPorDisciplina(d, f)

  for (const x of desempenho) {
    if (x.total >= MINIMO_QUESTOES_ANALISE && x.aproveitamento !== null && x.aproveitamento < LIMITE_BAIXO_APROVEITAMENTO) {
      out.push({
        id: `baixo-${x.disciplinaId}`,
        tipo: 'baixo_aproveitamento',
        tom: 'atencao',
        titulo: `Aproveitamento a reforçar: ${x.nome}`,
        detalhe: `${x.acertos} acertos em ${x.total} questões (${fmtP(x.aproveitamento)}); referência: abaixo de ${LIMITE_BAIXO_APROVEITAMENTO}% com pelo menos ${MINIMO_QUESTOES_ANALISE} questões.`
      })
    }
  }

  // Disciplinas negligenciadas: vinculadas a concursos em preparação e sem tempo registrado no período.
  const concursosAtivos = new Set(
    d.concursos.filter((c) => c.status === 'preparacao' && (!f.concursoId || c.id === f.concursoId)).map((c) => c.id)
  )
  const idsDisc = new Set(
    d.concursoDisciplinas.filter((r) => concursosAtivos.has(r.concursoId)).map((r) => r.disciplinaId)
  )
  const nomes = new Map(d.disciplinas.map((x) => [x.id, x]))
  for (const id of idsDisc) {
    const disc = nomes.get(id)
    if (!disc || disc.arquivada || (f.disciplinaId && f.disciplinaId !== id)) continue
    const noPer = sessoesFiltradas(d, { ...f, disciplinaId: id })
    if (totalSegundos(noPer) > 0) continue
    const ultima = d.sessoes
      .filter((s) => s.disciplinaId === id && (!f.concursoId || s.concursoId === f.concursoId) && s.data <= hoje)
      .map((s) => s.data)
      .sort()
      .pop()
    const diasSem = ultima ? diffDias(hoje, ultima) : null
    if (ultima && diasSem !== null && diasSem < DIAS_NEGLIGENCIADA && f.ate >= hoje) continue
    out.push({
      id: `neglig-${id}`,
      tipo: 'negligenciada',
      titulo: `Sem tempo registrado: ${disc.nome}`,
      tom: 'atencao',
      detalhe: ultima
        ? `Nenhuma sessão no período. Último estudo registrado: ${formatarData(ultima)} (${diasSem} dias atrás).`
        : 'Nenhuma sessão registrada para esta disciplina até agora.'
    })
  }

  // Queda/melhora comparando períodos equivalentes.
  const per = periodosComparaveis(f, hoje)
  if (per) {
    for (const l of compararDisciplinas(d, per)) {
      const a = l.atual
      const b = l.anterior
      if (!a || !b || a.total < MINIMO_QUESTOES_ANALISE || b.total < MINIMO_QUESTOES_ANALISE || l.deltaAproveitamento === null) continue
      if (Math.abs(l.deltaAproveitamento) < VARIACAO_RELEVANTE_PP) continue
      const queda = l.deltaAproveitamento < 0
      out.push({
        id: `var-${l.disciplinaId}`,
        tipo: queda ? 'queda' : 'melhora',
        tom: queda ? 'atencao' : 'positivo',
        titulo: `${queda ? 'Queda' : 'Melhora'} em ${l.nome}`,
        detalhe: `${fmtP(a.aproveitamento)} (${a.total} questões) contra ${fmtP(b.aproveitamento)} (${b.total}) no período anterior${per.parcial ? `, comparando apenas os primeiros ${per.dias} dias de cada período` : ''}.`
      })
    }
  }

  // Revisões acumuladas.
  const ind = calcularIndicadores(d, f, cfg, hoje, agora)
  if (ind.revisoesVencidas > 0 || ind.errosPendentes > 0) {
    out.push({
      id: 'revisoes',
      tipo: 'revisoes',
      tom: ind.revisoesVencidas >= 20 ? 'atencao' : 'neutro',
      titulo: 'Revisões pendentes',
      detalhe: `${ind.revisoesVencidas} flashcards vencidos e ${ind.errosPendentes} erros aguardando revisão.`
    })
  }

  // Metas x resultados.
  if (ind.metaSegundos) {
    out.push({
      id: 'meta-horas',
      tipo: 'metas',
      tom: ind.segundos >= ind.metaSegundos ? 'positivo' : 'neutro',
      titulo: 'Meta de horas',
      detalhe: `${fmtH(ind.segundos)} estudadas de ${fmtH(ind.metaSegundos)} previstas nos dias disponíveis já decorridos do período.`
    })
  }
  if (ind.metaQuestoes) {
    out.push({
      id: 'meta-questoes',
      tipo: 'metas',
      tom: ind.questoes.total >= ind.metaQuestoes ? 'positivo' : 'neutro',
      titulo: 'Meta de questões',
      detalhe: `${ind.questoes.total} questões resolvidas de ${ind.metaQuestoes} previstas nos dias disponíveis já decorridos do período.`
    })
  }
  return out
}
