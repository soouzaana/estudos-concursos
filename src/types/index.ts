/** Tipos centrais do domínio. Datas "YYYY-MM-DD" são datas locais; instantes são epoch em ms. */

export type ID = string
export type DataISO = string // YYYY-MM-DD (data local)

export type SituacaoEdital = 'sem_edital' | 'edital_publicado' | 'inscricoes_abertas'
export type StatusConcurso = 'preparacao' | 'pausado' | 'concluido' | 'arquivado'

export interface Concurso {
  id: ID
  nome: string
  orgao: string
  cargo: string
  banca: string
  situacaoEdital: SituacaoEdital
  dataProva?: DataISO
  dataInicio: DataISO
  metaSemanalHoras: number
  metaQuestoes: number
  observacoes: string
  status: StatusConcurso
  criadoEm: number
  atualizadoEm: number
}

export type StatusProgresso = 'nao_iniciado' | 'em_andamento' | 'concluido'

export interface Disciplina {
  id: ID
  nome: string
  descricao: string
  cor: string
  ordem: number
  status: StatusProgresso
  observacoes: string
  /** Disciplinas com histórico não são apagadas: ficam arquivadas e somem dos seletores. */
  arquivada?: boolean
  criadoEm: number
}

/** Relação N:N entre concurso e disciplina (a disciplina é cadastrada uma única vez). */
export interface ConcursoDisciplina {
  id: ID
  concursoId: ID
  disciplinaId: ID
  ordem: number
}

export interface Topico {
  id: ID
  disciplinaId: ID
  parentId?: ID
  nome: string
  ordem: number
  status: StatusProgresso
  observacoes: string
  arquivado?: boolean
}

export type StatusAtividade = 'pendente' | 'em_andamento' | 'concluida' | 'pulada'
export type Prioridade = 'baixa' | 'media' | 'alta'

export interface Atividade {
  id: ID
  concursoId: ID
  disciplinaId: ID
  topicoId?: ID
  /** Data originalmente planejada. Nunca é sobrescrita por reagendamentos. */
  dataPlanejada: DataISO
  /** Data para a qual a atividade foi reagendada (se houve). */
  reagendadaPara?: DataISO
  /** Data real em que foi concluída. */
  dataRealizacao?: DataISO
  horario?: string // HH:mm
  duracaoMin: number
  questoesPrevistas: number
  prioridade: Prioridade
  status: StatusAtividade
  observacoes: string
  ordem: number
  criadoEm: number
  atualizadoEm: number
}

export type TipoEventoCronograma =
  | 'criada'
  | 'editada'
  | 'iniciada'
  | 'concluida'
  | 'pulada'
  | 'reagendada'
  | 'reaberta'
  | 'excluida'

export interface EventoCronograma {
  id: ID
  atividadeId: ID
  concursoId: ID
  em: number
  tipo: TipoEventoCronograma
  detalhe: string
  de?: string
  para?: string
}

export type MetodoEstudo = 'teoria' | 'videoaula' | 'leitura' | 'questoes' | 'revisao' | 'simulado' | 'outro'

export interface Sessao {
  id: ID
  /** Atribuição única: cada sessão pertence a no máximo um concurso (evita contagem dupla). */
  concursoId?: ID
  disciplinaId?: ID
  topicoId?: ID
  atividadeId?: ID
  data: DataISO
  inicio: number
  fim: number
  /** Tempo efetivamente estudado (exclui pausas). */
  duracaoSeg: number
  metodo: MetodoEstudo
  observacoes: string
  manual: boolean
  criadoEm: number
}

export interface BlocoQuestoes {
  id: ID
  data: DataISO
  concursoIds: ID[]
  disciplinaId: ID
  topicoId?: ID
  fonte: string
  total: number
  acertos: number
  observacoes: string
  criadoEm: number
}

export type MotivoErro =
  | 'falta_conhecimento'
  | 'esquecimento'
  | 'interpretacao'
  | 'desatencao'
  | 'confusao_conceitos'
  | 'erro_calculo'
  | 'falta_tempo'
  | 'outro'

export type Dificuldade = 'facil' | 'media' | 'dificil'

export interface RevisaoErro {
  em: number
  nota?: string
}

export interface Erro {
  id: ID
  blocoId?: ID
  enunciado: string
  alternativas: string[]
  respostaMarcada: string
  respostaCorreta: string
  explicacao: string
  motivo: MotivoErro
  disciplinaId: ID
  topicoId?: ID
  concursoIds: ID[]
  fonte: string
  data: DataISO
  dificuldade: Dificuldade
  tags: string[]
  statusRevisao: 'pendente' | 'revisado'
  arquivado: boolean
  revisoes: RevisaoErro[]
  criadoEm: number
}

/** Estado serializado do cartão no algoritmo FSRS (ts-fsrs). Datas em epoch ms. */
export interface EstadoFsrs {
  due: number
  stability: number
  difficulty: number
  elapsedDays: number
  scheduledDays: number
  learningSteps: number
  reps: number
  lapses: number
  state: number
  lastReview?: number
}

export interface Cartao {
  id: ID
  frente: string
  verso: string
  disciplinaId?: ID
  topicoId?: ID
  concursoIds: ID[]
  tags: string[]
  dificuldade: Dificuldade
  origemErroId?: ID
  criadoEm: number
  /** Próxima revisão (epoch ms), indexado para consultas de vencimento. */
  proximaRevisao: number
  fsrs: EstadoFsrs
  arquivado: boolean
}

export type NotaRevisao = 'errei' | 'dificil' | 'bom' | 'facil'

export interface RevisaoCartao {
  id: ID
  cartaoId: ID
  em: number
  data: DataISO
  nota: NotaRevisao
  estadoAnterior: number
  estadoNovo: number
  intervaloDias: number
}

export interface MarcacaoDia {
  data: DataISO
  tipo: 'pulado'
  motivo: string
}

export type ModoTema = 'claro' | 'escuro' | 'automatico'
export type PaletaTema = 'roxo' | 'rosa' | 'azul' | 'verde' | 'lilas' | 'neutro' | 'personalizada'

export interface MetaVigente {
  /** A partir de quando (inclusive) esta meta vale. Alterações não afetam datas anteriores. */
  desde: DataISO
  metaDiariaMin: number
  metaSemanalMin: number
  metaQuestoesDia: number
}

export type ComportamentoAtrasadas = 'manter' | 'oferecer_reagendar'

export interface Configuracoes {
  modo: ModoTema
  paleta: PaletaTema
  corPersonalizada: string
  metas: MetaVigente[]
  diasDisponiveis: number[] // 0=domingo ... 6=sábado
  horariosPreferidos: string
  tempoPadraoSessaoMin: number
  intervaloMin: number
  atrasadas: ComportamentoAtrasadas
  novosCartoesPorDia: number
  retencaoDesejada: number // 0.7 a 0.99
  duracaoPadraoAtividadeMin: number
}

export interface EstadoCronometro {
  concursoId?: ID
  disciplinaId?: ID
  topicoId?: ID
  atividadeId?: ID
  metodo: MetodoEstudo
  observacoes: string
  iniciadoEm: number
  status: 'rodando' | 'pausado'
  acumuladoMs: number
  retomadoEm: number // instante da última retomada (válido se rodando)
}

export const METODOS: { valor: MetodoEstudo; rotulo: string }[] = [
  { valor: 'teoria', rotulo: 'Teoria' },
  { valor: 'videoaula', rotulo: 'Videoaula' },
  { valor: 'leitura', rotulo: 'Leitura' },
  { valor: 'questoes', rotulo: 'Questões' },
  { valor: 'revisao', rotulo: 'Revisão' },
  { valor: 'simulado', rotulo: 'Simulado' },
  { valor: 'outro', rotulo: 'Outro' }
]

export const MOTIVOS: { valor: MotivoErro; rotulo: string }[] = [
  { valor: 'falta_conhecimento', rotulo: 'Falta de conhecimento' },
  { valor: 'esquecimento', rotulo: 'Esquecimento' },
  { valor: 'interpretacao', rotulo: 'Interpretação incorreta' },
  { valor: 'desatencao', rotulo: 'Desatenção' },
  { valor: 'confusao_conceitos', rotulo: 'Confusão entre conceitos' },
  { valor: 'erro_calculo', rotulo: 'Erro de cálculo' },
  { valor: 'falta_tempo', rotulo: 'Falta de tempo' },
  { valor: 'outro', rotulo: 'Outro' }
]

export const SITUACOES_EDITAL: { valor: SituacaoEdital; rotulo: string }[] = [
  { valor: 'sem_edital', rotulo: 'Sem edital' },
  { valor: 'edital_publicado', rotulo: 'Edital publicado' },
  { valor: 'inscricoes_abertas', rotulo: 'Inscrições abertas' }
]

export const STATUS_CONCURSO: { valor: StatusConcurso; rotulo: string }[] = [
  { valor: 'preparacao', rotulo: 'Em preparação' },
  { valor: 'pausado', rotulo: 'Pausado' },
  { valor: 'concluido', rotulo: 'Concluído' },
  { valor: 'arquivado', rotulo: 'Arquivado' }
]

export const STATUS_ATIVIDADE: { valor: StatusAtividade; rotulo: string }[] = [
  { valor: 'pendente', rotulo: 'Pendente' },
  { valor: 'em_andamento', rotulo: 'Em andamento' },
  { valor: 'concluida', rotulo: 'Concluída' },
  { valor: 'pulada', rotulo: 'Pulada' }
]

export const PRIORIDADES: { valor: Prioridade; rotulo: string }[] = [
  { valor: 'baixa', rotulo: 'Baixa' },
  { valor: 'media', rotulo: 'Média' },
  { valor: 'alta', rotulo: 'Alta' }
]

export const DIFICULDADES: { valor: Dificuldade; rotulo: string }[] = [
  { valor: 'facil', rotulo: 'Fácil' },
  { valor: 'media', rotulo: 'Média' },
  { valor: 'dificil', rotulo: 'Difícil' }
]
