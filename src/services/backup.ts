/**
 * Backup e restauração em JSON.
 *
 * Formato (versão 1):
 * {
 *   "app": "estudos-concursos",
 *   "formatoVersao": 1,
 *   "exportadoEm": "2026-01-01T12:00:00.000Z",
 *   "dados": { concursos: [], disciplinas: [], ... },
 *   "config": { configuracoes: { ... } }
 * }
 *
 * Migrações: para mudar o formato, incremente FORMATO_ATUAL e registre em MIGRACOES uma função
 * `N → N+1` (a chave é a versão de origem). Backups mais novos que o app são recusados.
 */
import { TABELAS_DADOS, type NomeTabela } from '@/db/database'
import { dadosVazios, exportarConfig, exportarDados, substituirDados, type DadosCompletos } from '@/db/repositorio'
import { dataValida } from '@/utils/datas'
import { normalizarConfiguracoes } from './configuracoes'

export const APP_ID = 'estudos-concursos'
export const FORMATO_ATUAL = 1

export interface ArquivoBackup {
  app: string
  formatoVersao: number
  exportadoEm: string
  dados: DadosCompletos
  config: Record<string, unknown>
}

export type Migracao = (backup: Record<string, unknown>) => Record<string, unknown>
export const MIGRACOES: Record<number, Migracao> = {
  // Exemplo para o futuro: 1: (b) => ({ ...b, formatoVersao: 2, dados: { ...(b.dados as object), novaTabela: [] } })
}

export interface ResultadoLeitura {
  ok: boolean
  backup?: ArquivoBackup
  erros: string[]
  avisos: string[]
  contagens: Record<string, number>
  versaoOriginal?: number
}

/* ------------------------------ esquema/validação -------------------------- */

type Tipo = 's' | 'n' | 'b' | 'd' | 'as' | 'arr' | 'obj'
interface Regra {
  t: Tipo
  opt?: boolean
  enum?: readonly string[]
  min?: number
  int?: boolean
}
const S: Regra = { t: 's' }
const SO: Regra = { t: 's', opt: true }
const N: Regra = { t: 'n', min: 0 }
const NO: Regra = { t: 'n', opt: true, min: 0 }
const B: Regra = { t: 'b' }
const D: Regra = { t: 'd' }
const DO: Regra = { t: 'd', opt: true }
const AS: Regra = { t: 'as' }
const E = (vals: readonly string[], opt = false): Regra => ({ t: 's', enum: vals, opt })

const ESQUEMA: Record<NomeTabela, Record<string, Regra>> = {
  concursos: {
    id: S, nome: S, orgao: S, cargo: S, banca: S,
    situacaoEdital: E(['sem_edital', 'edital_publicado', 'inscricoes_abertas']),
    dataProva: DO, dataInicio: D, metaSemanalHoras: N, metaQuestoes: N, observacoes: S,
    status: E(['preparacao', 'pausado', 'concluido', 'arquivado']), criadoEm: N, atualizadoEm: N
  },
  disciplinas: {
    id: S, nome: S, descricao: S, cor: S, ordem: { t: 'n' }, status: E(['nao_iniciado', 'em_andamento', 'concluido']),
    observacoes: S, arquivada: { t: 'b', opt: true }, criadoEm: N
  },
  concursoDisciplinas: { id: S, concursoId: S, disciplinaId: S, ordem: { t: 'n' } },
  topicos: {
    id: S, disciplinaId: S, parentId: SO, nome: S, ordem: { t: 'n' },
    status: E(['nao_iniciado', 'em_andamento', 'concluido']), observacoes: S, arquivado: { t: 'b', opt: true }
  },
  atividades: {
    id: S, concursoId: S, disciplinaId: S, topicoId: SO, dataPlanejada: D, reagendadaPara: DO, dataRealizacao: DO,
    horario: SO, duracaoMin: N, questoesPrevistas: N, prioridade: E(['baixa', 'media', 'alta']),
    status: E(['pendente', 'em_andamento', 'concluida', 'pulada']), observacoes: S, ordem: { t: 'n' },
    criadoEm: N, atualizadoEm: N
  },
  historicoCronograma: {
    id: S, atividadeId: S, concursoId: S, em: N,
    tipo: E(['criada', 'editada', 'iniciada', 'concluida', 'pulada', 'reagendada', 'reaberta', 'excluida']),
    detalhe: S, de: SO, para: SO
  },
  sessoes: {
    id: S, concursoId: SO, disciplinaId: SO, topicoId: SO, atividadeId: SO, data: D, inicio: N, fim: N, duracaoSeg: N,
    metodo: E(['teoria', 'videoaula', 'leitura', 'questoes', 'revisao', 'simulado', 'outro']), observacoes: S,
    manual: B, criadoEm: N
  },
  questoes: {
    id: S, data: D, concursoIds: AS, disciplinaId: S, topicoId: SO, fonte: S,
    total: { t: 'n', min: 0, int: true }, acertos: { t: 'n', min: 0, int: true }, observacoes: S, criadoEm: N
  },
  erros: {
    id: S, blocoId: SO, enunciado: S, alternativas: AS, respostaMarcada: S, respostaCorreta: S, explicacao: S,
    motivo: E(['falta_conhecimento', 'esquecimento', 'interpretacao', 'desatencao', 'confusao_conceitos', 'erro_calculo', 'falta_tempo', 'outro']),
    disciplinaId: S, topicoId: SO, concursoIds: AS, fonte: S, data: D, dificuldade: E(['facil', 'media', 'dificil']),
    tags: AS, statusRevisao: E(['pendente', 'revisado']), arquivado: B, revisoes: { t: 'arr' }, criadoEm: N
  },
  cartoes: {
    id: S, frente: S, verso: S, disciplinaId: SO, topicoId: SO, concursoIds: AS, tags: AS,
    dificuldade: E(['facil', 'media', 'dificil']), origemErroId: SO, criadoEm: N, proximaRevisao: N,
    fsrs: { t: 'obj' }, arquivado: B
  },
  revisoesCartao: {
    id: S, cartaoId: S, em: N, data: D, nota: E(['errei', 'dificil', 'bom', 'facil']),
    estadoAnterior: N, estadoNovo: N, intervaloDias: N
  },
  marcacoesDia: { data: D, tipo: E(['pulado']), motivo: S }
}

const CHAVE_PRIMARIA: Record<NomeTabela, string> = {
  concursos: 'id', disciplinas: 'id', concursoDisciplinas: 'id', topicos: 'id', atividades: 'id',
  historicoCronograma: 'id', sessoes: 'id', questoes: 'id', erros: 'id', cartoes: 'id', revisoesCartao: 'id',
  marcacoesDia: 'data'
}

function validarCampo(valor: unknown, r: Regra): string | null {
  if (valor === undefined || valor === null) return r.opt ? null : 'ausente'
  switch (r.t) {
    case 's':
      if (typeof valor !== 'string') return 'deve ser texto'
      if (r.enum && !r.enum.includes(valor)) return `valor inválido "${valor}"`
      return null
    case 'n':
      if (typeof valor !== 'number' || !Number.isFinite(valor)) return 'deve ser número'
      if (r.min !== undefined && valor < r.min) return `deve ser ≥ ${r.min}`
      if (r.int && !Number.isInteger(valor)) return 'deve ser inteiro'
      return null
    case 'b':
      return typeof valor === 'boolean' ? null : 'deve ser verdadeiro/falso'
    case 'd':
      return dataValida(valor) ? null : 'data inválida'
    case 'as':
      return Array.isArray(valor) && valor.every((x) => typeof x === 'string') ? null : 'deve ser lista de textos'
    case 'arr':
      return Array.isArray(valor) ? null : 'deve ser lista'
    case 'obj':
      return typeof valor === 'object' && !Array.isArray(valor) ? null : 'deve ser objeto'
  }
}

const MAX_ERROS_LISTADOS = 12

function validarDados(dados: Record<string, unknown>, erros: string[], avisos: string[]): DadosCompletos | null {
  const saida = dadosVazios()
  let falhou = false
  for (const nome of TABELAS_DADOS) {
    const bruto = dados[nome]
    if (bruto === undefined) {
      avisos.push(`Tabela "${nome}" ausente no arquivo (será considerada vazia).`)
      continue
    }
    if (!Array.isArray(bruto)) {
      erros.push(`Tabela "${nome}" deve ser uma lista.`)
      falhou = true
      continue
    }
    const regras = ESQUEMA[nome]
    const pk = CHAVE_PRIMARIA[nome]
    const vistos = new Set<string>()
    let nErros = 0
    bruto.forEach((reg: unknown, i: number) => {
      if (!reg || typeof reg !== 'object' || Array.isArray(reg)) {
        if (nErros++ < MAX_ERROS_LISTADOS) erros.push(`${nome}[${i}]: registro inválido.`)
        falhou = true
        return
      }
      const r = reg as Record<string, unknown>
      for (const [campo, regra] of Object.entries(regras)) {
        const problema = validarCampo(r[campo], regra)
        if (problema) {
          if (nErros++ < MAX_ERROS_LISTADOS) erros.push(`${nome}[${i}].${campo}: ${problema}.`)
          falhou = true
        }
      }
      const chave = r[pk]
      if (typeof chave === 'string') {
        if (vistos.has(chave)) {
          if (nErros++ < MAX_ERROS_LISTADOS) erros.push(`${nome}[${i}]: identificador duplicado "${chave}".`)
          falhou = true
        }
        vistos.add(chave)
      }
      if (nome === 'questoes' && typeof r.total === 'number' && typeof r.acertos === 'number' && r.acertos > r.total) {
        if (nErros++ < MAX_ERROS_LISTADOS) erros.push(`${nome}[${i}]: acertos maiores que o total.`)
        falhou = true
      }
      if (nome === 'sessoes' && typeof r.fim === 'number' && typeof r.inicio === 'number' && r.fim < r.inicio) {
        if (nErros++ < MAX_ERROS_LISTADOS) erros.push(`${nome}[${i}]: término anterior ao início.`)
        falhou = true
      }
    })
    if (nErros > MAX_ERROS_LISTADOS) erros.push(`${nome}: mais ${nErros - MAX_ERROS_LISTADOS} problemas omitidos.`)
    ;(saida as unknown as Record<string, unknown[]>)[nome] = bruto as unknown[]
  }
  if (falhou) return null

  // Integridade referencial essencial (bloqueante).
  const ids = (nome: NomeTabela) => new Set((saida[nome] as unknown as { id: string }[]).map((x) => x.id))
  const concursos = ids('concursos')
  const disciplinas = ids('disciplinas')
  const atividades = ids('atividades')
  const exigir = (cond: boolean, msg: string) => {
    if (!cond && erros.length < 40) erros.push(msg)
    if (!cond) falhou = true
  }
  saida.concursoDisciplinas.forEach((r) => {
    exigir(concursos.has(r.concursoId), `concursoDisciplinas: concurso inexistente (${r.concursoId}).`)
    exigir(disciplinas.has(r.disciplinaId), `concursoDisciplinas: disciplina inexistente (${r.disciplinaId}).`)
  })
  saida.topicos.forEach((t) => exigir(disciplinas.has(t.disciplinaId), `topicos: disciplina inexistente (${t.disciplinaId}).`))
  saida.atividades.forEach((a) => {
    exigir(concursos.has(a.concursoId), `atividades: concurso inexistente (${a.concursoId}).`)
    exigir(disciplinas.has(a.disciplinaId), `atividades: disciplina inexistente (${a.disciplinaId}).`)
  })
  saida.revisoesCartao.forEach((r) => {
    if (!ids('cartoes').has(r.cartaoId)) avisos.push('Há revisões de flashcards sem o cartão correspondente (serão importadas mesmo assim).')
  })
  const refsSoltas =
    saida.sessoes.filter((s) => (s.concursoId && !concursos.has(s.concursoId)) || (s.atividadeId && !atividades.has(s.atividadeId))).length +
    saida.questoes.filter((q) => q.concursoIds.some((c) => !concursos.has(c))).length
  if (refsSoltas > 0) avisos.push(`${refsSoltas} registro(s) apontam para concursos/atividades que não existem mais no arquivo.`)
  return falhou ? null : saida
}

/* ------------------------------- migração/leitura -------------------------- */

export function migrarBackup(
  bruto: Record<string, unknown>,
  migracoes: Record<number, Migracao> = MIGRACOES,
  alvo = FORMATO_ATUAL
): { ok: true; backup: Record<string, unknown> } | { ok: false; erro: string } {
  let atual = bruto
  const declarada = atual.formatoVersao
  if (typeof declarada !== 'number' || !Number.isInteger(declarada) || declarada < 1) {
    return { ok: false, erro: 'O arquivo não informa a versão do formato de backup.' }
  }
  let versao: number = declarada
  if (versao > alvo) {
    return { ok: false, erro: `Este backup foi criado por uma versão mais nova do app (formato ${versao}). Atualize o aplicativo para importá-lo.` }
  }
  while (versao < alvo) {
    const m = migracoes[versao]
    if (!m) return { ok: false, erro: `Não há migração disponível do formato ${versao} para ${versao + 1}.` }
    try {
      atual = m(atual)
    } catch (e) {
      return { ok: false, erro: `Falha ao migrar o backup do formato ${versao}: ${(e as Error).message}` }
    }
    const nova = atual.formatoVersao
    if (typeof nova !== 'number' || nova <= versao) return { ok: false, erro: 'Migração de backup inconsistente.' }
    versao = nova
  }
  return { ok: true, backup: atual }
}

/** Lê, migra e valida o conteúdo de um arquivo de backup SEM tocar nos dados existentes. */
export function lerBackup(texto: string, migracoes: Record<number, Migracao> = MIGRACOES, alvo = FORMATO_ATUAL): ResultadoLeitura {
  const erros: string[] = []
  const avisos: string[] = []
  let bruto: unknown
  try {
    bruto = JSON.parse(texto)
  } catch {
    return { ok: false, erros: ['O arquivo não é um JSON válido.'], avisos, contagens: {} }
  }
  if (!bruto || typeof bruto !== 'object' || Array.isArray(bruto)) {
    return { ok: false, erros: ['Estrutura inesperada: o conteúdo deveria ser um objeto.'], avisos, contagens: {} }
  }
  const obj = bruto as Record<string, unknown>
  if (obj.app !== APP_ID) {
    return { ok: false, erros: ['Este arquivo não parece ser um backup deste aplicativo.'], avisos, contagens: {} }
  }
  const versaoOriginal = typeof obj.formatoVersao === 'number' ? obj.formatoVersao : undefined
  const mig = migrarBackup(obj, migracoes, alvo)
  if (!mig.ok) return { ok: false, erros: [mig.erro], avisos, contagens: {}, versaoOriginal }
  const b = mig.backup
  if (!b.dados || typeof b.dados !== 'object' || Array.isArray(b.dados)) {
    return { ok: false, erros: ['O backup não contém a seção "dados".'], avisos, contagens: {}, versaoOriginal }
  }
  const dados = validarDados(b.dados as Record<string, unknown>, erros, avisos)
  if (!dados) return { ok: false, erros, avisos, contagens: {}, versaoOriginal }

  const configBruta = b.config && typeof b.config === 'object' && !Array.isArray(b.config) ? (b.config as Record<string, unknown>) : {}
  const config: Record<string, unknown> = {}
  if (configBruta.configuracoes !== undefined) config.configuracoes = normalizarConfiguracoes(configBruta.configuracoes)
  else avisos.push('O backup não traz configurações; as atuais serão mantidas como padrão.')

  const contagens: Record<string, number> = {}
  for (const n of TABELAS_DADOS) contagens[n] = (dados[n] as unknown[]).length
  return {
    ok: true,
    erros,
    avisos,
    contagens,
    versaoOriginal,
    backup: {
      app: APP_ID,
      formatoVersao: alvo,
      exportadoEm: typeof b.exportadoEm === 'string' ? b.exportadoEm : new Date().toISOString(),
      dados,
      config
    }
  }
}

/* -------------------------------- exportar/importar ----------------------- */

export async function montarBackup(agora = new Date()): Promise<ArquivoBackup> {
  const [dados, config] = await Promise.all([exportarDados(), exportarConfig()])
  return { app: APP_ID, formatoVersao: FORMATO_ATUAL, exportadoEm: agora.toISOString(), dados, config }
}

export const serializarBackup = (b: ArquivoBackup) => JSON.stringify(b, null, 2)

export function nomeArquivoBackup(agora = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `backup-estudos-concursos-${agora.getFullYear()}${p(agora.getMonth() + 1)}${p(agora.getDate())}-${p(agora.getHours())}${p(agora.getMinutes())}.json`
}

/** Aplica um backup JÁ VALIDADO. A substituição é atômica (transação única). */
export async function restaurarBackup(b: ArquivoBackup): Promise<void> {
  await substituirDados(b.dados, b.config)
}
