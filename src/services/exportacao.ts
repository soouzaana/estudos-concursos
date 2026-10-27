/**
 * Montagem (pura, sem DOM) do planner exportável do cronograma.
 * O resultado (`PaginaPlanner[]`) é renderizado por `PlannerPagina.vue` e convertido em PNG/PDF
 * por `exportarPlanner.ts`. Nada aqui altera os dados originais.
 */
import type { Atividade, Concurso, DataISO, Disciplina, ID, StatusAtividade, Topico } from '@/types'
import { STATUS_ATIVIDADE } from '@/types'
import { compararAtividades, dataEfetiva } from './cronograma'
import { diaSemanaCurto, diaSemanaLongo, fimMes, fimSemana, formatarData, formatarDataCurta, inicioMes, inicioSemana, intervaloDias } from '@/utils/datas'
import { metaVigente } from './stats'
import type { MetaVigente } from '@/types'

export type PeriodoExport = 'dia' | 'semana' | 'mes'
export type Orientacao = 'retrato' | 'paisagem'
export type Formato = 'pdf' | 'png'

export interface OpcoesExportacao {
  concursoId?: ID
  periodo: PeriodoExport
  de: DataISO
  ate: DataISO
  horarios: boolean
  metas: boolean
  status: boolean
  formato: Formato
  orientacao: Orientacao
}

export interface DadosPlanner {
  concursos: Concurso[]
  disciplinas: Disciplina[]
  topicos: Topico[]
  atividades: Atividade[]
  metas: MetaVigente[]
}

export interface LinhaPlanner {
  id: ID
  concurso?: string
  disciplina: string
  cor: string
  topico: string
  horario?: string
  duracao: string
  questoes: number
  status: StatusAtividade
  statusRotulo: string
  reagendada: boolean
}

export interface BlocoDia {
  data: DataISO
  diaLongo: string
  diaCurto: string
  dataCurta: string
  /** true quando o dia continua da página anterior. */
  continuacao: boolean
  linhas: LinhaPlanner[]
}

export interface ResumoMetasPlanner {
  atividades: number
  minutosPrevistos: number
  questoesPrevistas: number
  metaDiariaMin: number
  metaSemanalMin: number
  metaQuestoesDia: number
  /** Meta semanal (horas) do concurso selecionado. */
  metaSemanalConcursoH?: number
}

export interface PaginaPlanner {
  numero: number
  total: number
  titulo: string
  subtitulo: string
  periodo: string
  blocos: BlocoDia[]
  metas?: ResumoMetasPlanner
  incluirHorarios: boolean
  incluirStatus: boolean
  mostrarConcurso: boolean
  vazia: boolean
}

export const CAPACIDADE_PADRAO: Record<Orientacao, number> = { retrato: 24, paisagem: 14 }
/** Peso (em linhas) do cabeçalho de cada dia no cálculo de capacidade. */
const PESO_CABECALHO_DIA = 1.6

/* --------------------------------- período --------------------------------- */

/** Intervalo padrão sugerido para um tipo de período, a partir de uma data âncora. */
export function intervaloDoPeriodo(periodo: PeriodoExport, ancora: DataISO): { de: DataISO; ate: DataISO } {
  if (periodo === 'dia') return { de: ancora, ate: ancora }
  if (periodo === 'semana') return { de: inicioSemana(ancora), ate: fimSemana(ancora) }
  return { de: inicioMes(ancora), ate: fimMes(ancora) }
}

export function validarOpcoes(o: Pick<OpcoesExportacao, 'de' | 'ate'>): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(o.de) || !/^\d{4}-\d{2}-\d{2}$/.test(o.ate)) return 'Informe as datas inicial e final.'
  if (o.de > o.ate) return 'A data inicial deve ser anterior (ou igual) à data final.'
  if (intervaloDias(o.de, o.ate).length > 366) return 'O período máximo para exportação é de 366 dias.'
  return null
}

export const rotuloStatus = (s: StatusAtividade) => STATUS_ATIVIDADE.find((x) => x.valor === s)?.rotulo ?? s

export function formatarMinutos(min: number): string {
  if (min <= 0) return '0 min'
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  if (h === 0) return `${m} min`
  return m === 0 ? `${h} h` : `${h} h ${m} min`
}

/* ---------------------------------- linhas --------------------------------- */

export function selecionarAtividades(dados: Pick<DadosPlanner, 'atividades'>, o: Pick<OpcoesExportacao, 'concursoId' | 'de' | 'ate'>): Atividade[] {
  return dados.atividades
    .filter((a) => {
      const d = dataEfetiva(a)
      return d >= o.de && d <= o.ate && (!o.concursoId || a.concursoId === o.concursoId)
    })
    .sort(compararAtividades)
}

function montarLinha(a: Atividade, dados: DadosPlanner): LinhaPlanner {
  const disc = dados.disciplinas.find((d) => d.id === a.disciplinaId)
  const topico = a.topicoId ? dados.topicos.find((t) => t.id === a.topicoId) : undefined
  const conc = dados.concursos.find((c) => c.id === a.concursoId)
  return {
    id: a.id,
    concurso: conc?.nome,
    disciplina: disc?.nome ?? 'Disciplina removida',
    cor: disc?.cor ?? '#94a3b8',
    topico: topico?.nome ?? a.observacoes.split('\n')[0].slice(0, 90),
    horario: a.horario || undefined,
    duracao: formatarMinutos(a.duracaoMin),
    questoes: a.questoesPrevistas,
    status: a.status,
    statusRotulo: rotuloStatus(a.status),
    reagendada: !!a.reagendadaPara && a.reagendadaPara !== a.dataPlanejada
  }
}

function montarBlocosPorDia(atividades: Atividade[], dados: DadosPlanner, o: OpcoesExportacao): BlocoDia[] {
  const porDia = new Map<DataISO, Atividade[]>()
  for (const a of atividades) {
    const d = dataEfetiva(a)
    porDia.set(d, [...(porDia.get(d) ?? []), a])
  }
  const dias = intervaloDias(o.de, o.ate)
  // Em períodos curtos mostramos todos os dias (dias livres ficam visíveis); no mensal, só os que têm atividade.
  const mostrarVazios = dias.length <= 7
  return dias
    .filter((d) => mostrarVazios || porDia.has(d))
    .map((d) => ({
      data: d,
      diaLongo: diaSemanaLongo(d),
      diaCurto: diaSemanaCurto(d),
      dataCurta: formatarDataCurta(d),
      continuacao: false,
      linhas: (porDia.get(d) ?? []).map((a) => montarLinha(a, dados))
    }))
}

/* -------------------------------- paginação -------------------------------- */

const pesoBloco = (b: BlocoDia) => PESO_CABECALHO_DIA + Math.max(1, b.linhas.length)

/**
 * Distribui os dias em páginas sem cortar conteúdo: um dia nunca é dividido, a menos que sozinho
 * exceda a capacidade (aí continua na página seguinte, repetindo o cabeçalho do dia).
 */
export function paginarPorCapacidade(blocos: BlocoDia[], capacidade: number): BlocoDia[][] {
  const paginas: BlocoDia[][] = []
  let atual: BlocoDia[] = []
  let usado = 0
  const nova = () => {
    if (atual.length) paginas.push(atual)
    atual = []
    usado = 0
  }
  for (const bloco of blocos) {
    let restante = bloco
    while (pesoBloco(restante) > capacidade) {
      // Dia maior que a página: divide em partes.
      if (usado > 0) nova()
      const cabem = Math.max(1, Math.floor(capacidade - PESO_CABECALHO_DIA))
      atual.push({ ...restante, linhas: restante.linhas.slice(0, cabem) })
      usado = capacidade
      restante = { ...restante, continuacao: true, linhas: restante.linhas.slice(cabem) }
      nova()
    }
    if (usado + pesoBloco(restante) > capacidade && usado > 0) nova()
    atual.push(restante)
    usado += pesoBloco(restante)
  }
  if (atual.length) paginas.push(atual)
  return paginas
}

/** Para imagens PNG: uma imagem por semana (dias da mesma semana ficam juntos). */
export function paginarPorSemana(blocos: BlocoDia[]): BlocoDia[][] {
  const grupos = new Map<DataISO, BlocoDia[]>()
  for (const b of blocos) {
    const chave = inicioSemana(b.data)
    grupos.set(chave, [...(grupos.get(chave) ?? []), b])
  }
  return [...grupos.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([, v]) => v)
}

/* --------------------------------- resumo ---------------------------------- */

function resumoDasLinhas(blocos: BlocoDia[], dados: DadosPlanner, concursoId?: ID): ResumoMetasPlanner {
  const linhas = blocos.flatMap((b) => b.linhas)
  const ultimo = blocos.length ? blocos[blocos.length - 1].data : '9999-12-31'
  const meta = metaVigente(dados.metas, ultimo)
  const conc = concursoId ? dados.concursos.find((c) => c.id === concursoId) : undefined
  return {
    atividades: linhas.length,
    minutosPrevistos: linhasMinutos(blocos, dados),
    questoesPrevistas: linhas.reduce((s, l) => s + l.questoes, 0),
    metaDiariaMin: meta.metaDiariaMin,
    metaSemanalMin: meta.metaSemanalMin,
    metaQuestoesDia: meta.metaQuestoesDia,
    metaSemanalConcursoH: conc?.metaSemanalHoras
  }
}

function linhasMinutos(blocos: BlocoDia[], dados: DadosPlanner): number {
  const ids = new Set(blocos.flatMap((b) => b.linhas.map((l) => l.id)))
  return dados.atividades.filter((a) => ids.has(a.id)).reduce((s, a) => s + a.duracaoMin, 0)
}

/* ---------------------------------- principal ------------------------------- */

export function tituloPlanner(o: OpcoesExportacao): string {
  return o.periodo === 'dia' ? 'Planner do dia' : o.periodo === 'semana' ? 'Planner semanal' : 'Planner mensal'
}

export function montarPlanner(o: OpcoesExportacao, dados: DadosPlanner, capacidade = CAPACIDADE_PADRAO[o.orientacao]): PaginaPlanner[] {
  const erro = validarOpcoes(o)
  if (erro) throw new Error(erro)
  const conc = o.concursoId ? dados.concursos.find((c) => c.id === o.concursoId) : undefined
  const atividades = selecionarAtividades(dados, o)
  const blocos = montarBlocosPorDia(atividades, dados, o)
  const grupos = blocos.length === 0 ? [[] as BlocoDia[]] : o.formato === 'png' ? paginarPorSemana(blocos) : paginarPorCapacidade(blocos, capacidade)
  const periodoTxt = o.de === o.ate ? formatarData(o.de) : `${formatarData(o.de)} a ${formatarData(o.ate)}`
  const subtitulo = conc ? [conc.nome, conc.cargo, conc.orgao].filter(Boolean).join(' · ') : 'Todos os concursos'
  return grupos.map((g, i) => ({
    numero: i + 1,
    total: grupos.length,
    titulo: tituloPlanner(o),
    subtitulo,
    periodo: g.length ? (g[0].data === g[g.length - 1].data ? formatarData(g[0].data) : `${formatarData(g[0].data)} a ${formatarData(g[g.length - 1].data)}`) : periodoTxt,
    blocos: g,
    metas: o.metas ? resumoDasLinhas(g, dados, o.concursoId) : undefined,
    incluirHorarios: o.horarios,
    incluirStatus: o.status,
    mostrarConcurso: !o.concursoId,
    vazia: atividades.length === 0
  }))
}

/* ------------------------------- nomes de arquivo -------------------------- */

export function nomeBase(o: Pick<OpcoesExportacao, 'concursoId' | 'de' | 'ate'>, concursos: Concurso[]): string {
  const c = o.concursoId ? concursos.find((x) => x.id === o.concursoId)?.nome : 'todos'
  const slug = (c ?? 'cronograma')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  return `cronograma-${slug || 'concurso'}-${o.de}_a_${o.ate}`
}
