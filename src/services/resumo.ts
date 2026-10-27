import type { Atividade, ID } from '@/types'
import { progressoCronograma, proximaAtividade, type ProgressoCronograma } from './cronograma'
import { questoesFiltradas, sessoesFiltradas, totaisQuestoes, totalSegundos, type DadosStats, type TotaisQuestoes } from './stats'

export interface ResumoConcurso {
  segundos: number
  questoes: TotaisQuestoes
  progresso: ProgressoCronograma
  proxima?: Atividade
}

const TUDO = { de: '0000-01-01', ate: '9999-12-31' }

/** Totais de um concurso, sem misturar com os demais (sessões e questões têm atribuição explícita). */
export function resumoConcurso(d: DadosStats, concursoId: ID): ResumoConcurso {
  const f = { ...TUDO, concursoId }
  const atividades = d.atividades.filter((a) => a.concursoId === concursoId)
  return {
    segundos: totalSegundos(sessoesFiltradas(d, f)),
    questoes: totaisQuestoes(questoesFiltradas(d, f)),
    progresso: progressoCronograma(atividades),
    proxima: proximaAtividade(atividades)
  }
}
