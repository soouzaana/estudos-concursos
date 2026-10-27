import type { Atividade, BlocoQuestoes, Cartao, Concurso, Configuracoes, Disciplina, Erro, Sessao } from '@/types'
import { configPadrao } from '@/services/configuracoes'
import { estadoInicial } from '@/services/fsrs'
import type { DadosStats } from '@/services/stats'

let n = 0
export const uid = (p = 'id') => `${p}-${++n}`

export function concurso(p: Partial<Concurso> = {}): Concurso {
  return {
    id: uid('c'), nome: 'Concurso', orgao: 'Órgão', cargo: 'Analista', banca: 'Banca', situacaoEdital: 'sem_edital',
    dataInicio: '2026-01-01', metaSemanalHoras: 10, metaQuestoes: 100, observacoes: '', status: 'preparacao',
    criadoEm: 1, atualizadoEm: 1, ...p
  }
}
export function disciplina(p: Partial<Disciplina> = {}): Disciplina {
  return { id: uid('d'), nome: 'Disciplina', descricao: '', cor: '#7c3aed', ordem: 0, status: 'nao_iniciado', observacoes: '', criadoEm: 1, ...p }
}
export function atividade(p: Partial<Atividade> = {}): Atividade {
  return {
    id: uid('a'), concursoId: 'c1', disciplinaId: 'd1', dataPlanejada: '2026-03-02', duracaoMin: 60, questoesPrevistas: 0,
    prioridade: 'media', status: 'pendente', observacoes: '', ordem: 0, criadoEm: 1, atualizadoEm: 1, ...p
  }
}
export function sessao(p: Partial<Sessao> = {}): Sessao {
  return {
    id: uid('s'), data: '2026-03-02', inicio: 1, fim: 2, duracaoSeg: 3600, metodo: 'teoria', observacoes: '',
    manual: false, criadoEm: 1, ...p
  }
}
export function bloco(p: Partial<BlocoQuestoes> = {}): BlocoQuestoes {
  return { id: uid('q'), data: '2026-03-02', concursoIds: [], disciplinaId: 'd1', fonte: '', total: 10, acertos: 7, observacoes: '', criadoEm: 1, ...p }
}
export function erro(p: Partial<Erro> = {}): Erro {
  return {
    id: uid('e'), enunciado: 'Enunciado', alternativas: [], respostaMarcada: 'A', respostaCorreta: 'B', explicacao: '',
    motivo: 'esquecimento', disciplinaId: 'd1', concursoIds: [], fonte: '', data: '2026-03-02', dificuldade: 'media',
    tags: [], statusRevisao: 'pendente', arquivado: false, revisoes: [], criadoEm: 1, ...p
  }
}
export function cartao(p: Partial<Cartao> = {}): Cartao {
  const fsrs = estadoInicial(1_000)
  return {
    id: uid('k'), frente: 'F', verso: 'V', concursoIds: [], tags: [], dificuldade: 'media', criadoEm: 1_000,
    proximaRevisao: fsrs.due, fsrs, arquivado: false, ...p
  }
}
export function cfg(p: Partial<Configuracoes> = {}): Configuracoes {
  return { ...configPadrao(), ...p }
}
export function dados(p: Partial<DadosStats> = {}): DadosStats {
  return {
    concursos: [], disciplinas: [], concursoDisciplinas: [], topicos: [], atividades: [], sessoes: [], questoes: [],
    erros: [], cartoes: [], revisoesCartao: [], marcacoesDia: [], ...p
  }
}
