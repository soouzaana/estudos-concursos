import Dexie, { type Table } from 'dexie'
import type {
  Atividade,
  BlocoQuestoes,
  Cartao,
  Concurso,
  ConcursoDisciplina,
  Disciplina,
  Erro,
  EventoCronograma,
  MarcacaoDia,
  RevisaoCartao,
  Sessao,
  Topico
} from '@/types'

export interface RegistroConfig {
  chave: string
  valor: unknown
}

export const NOME_BANCO = 'estudos-concursos-db'

/** Nomes das tabelas que fazem parte de backups, na ordem de exportação. */
export const TABELAS_DADOS = [
  'concursos',
  'disciplinas',
  'concursoDisciplinas',
  'topicos',
  'atividades',
  'historicoCronograma',
  'sessoes',
  'questoes',
  'erros',
  'cartoes',
  'revisoesCartao',
  'marcacoesDia'
] as const
export type NomeTabela = (typeof TABELAS_DADOS)[number]

export class BancoEstudos extends Dexie {
  concursos!: Table<Concurso, string>
  disciplinas!: Table<Disciplina, string>
  concursoDisciplinas!: Table<ConcursoDisciplina, string>
  topicos!: Table<Topico, string>
  atividades!: Table<Atividade, string>
  historicoCronograma!: Table<EventoCronograma, string>
  sessoes!: Table<Sessao, string>
  questoes!: Table<BlocoQuestoes, string>
  erros!: Table<Erro, string>
  cartoes!: Table<Cartao, string>
  revisoesCartao!: Table<RevisaoCartao, string>
  marcacoesDia!: Table<MarcacaoDia, string>
  config!: Table<RegistroConfig, string>

  constructor(nome = NOME_BANCO) {
    super(nome)

    // Versão 1 — esquema inicial.
    // Futuras alterações: acrescente `this.version(2).stores({...}).upgrade(tx => ...)`
    // sem remover as versões anteriores, para que o Dexie migre os dados existentes.
    this.version(1).stores({
      concursos: 'id, status, nome, criadoEm',
      disciplinas: 'id, nome, ordem',
      concursoDisciplinas: 'id, concursoId, disciplinaId, [concursoId+disciplinaId]',
      topicos: 'id, disciplinaId, parentId, ordem',
      atividades: 'id, concursoId, disciplinaId, dataPlanejada, reagendadaPara, status, ordem',
      historicoCronograma: 'id, atividadeId, concursoId, em',
      sessoes: 'id, concursoId, disciplinaId, data, atividadeId, inicio',
      questoes: 'id, data, disciplinaId, *concursoIds',
      erros: 'id, data, disciplinaId, topicoId, motivo, statusRevisao, arquivado, *concursoIds, *tags',
      cartoes: 'id, proximaRevisao, disciplinaId, topicoId, origemErroId, *concursoIds, *tags',
      revisoesCartao: 'id, cartaoId, data, em',
      marcacoesDia: 'data',
      config: 'chave'
    })
  }
}

export let banco = new BancoEstudos()

/** Usado nos testes para trocar a instância por um banco isolado. */
export function substituirBanco(novo: BancoEstudos) {
  banco = novo
}
