import { describe, expect, it } from 'vitest'
import {
  calcularIndicadores, classificarDia, compararDisciplinas, consistenciaPorPeriodo, construirContextoDias,
  desempenhoPorDisciplina, gerarInsights, horasPorPeriodo, metaVigente, periodosComparaveis, questoesFiltradas,
  questoesPorPeriodo, sessoesFiltradas, topicosMaisDificeis, totaisQuestoes
} from '@/services/stats'
import { atividade, bloco, cartao, cfg, concurso, dados, disciplina, erro, sessao } from './fabricas'
import type { MetaVigente } from '@/types'

const HOJE = '2026-03-11' // quarta-feira
const F = { de: '2026-03-01', ate: '2026-03-31' }
const conf = cfg({ diasDisponiveis: [1, 2, 3, 4, 5], metas: [{ desde: '0000-01-01', metaDiariaMin: 60, metaSemanalMin: 300, metaQuestoesDia: 10 }] })

describe('isolamento de estatísticas por concurso', () => {
  const d = dados({
    sessoes: [
      sessao({ concursoId: 'A', data: '2026-03-02', duracaoSeg: 3600 }),
      sessao({ concursoId: 'B', data: '2026-03-02', duracaoSeg: 1800 }),
      sessao({ data: '2026-03-03', duracaoSeg: 600 })
    ],
    questoes: [
      bloco({ concursoIds: ['A'], total: 10, acertos: 8 }),
      bloco({ concursoIds: ['B'], total: 20, acertos: 10 }),
      bloco({ concursoIds: ['A', 'B'], total: 10, acertos: 5 })
    ]
  })

  it('sessões nunca são contadas em dois concursos', () => {
    const a = sessoesFiltradas(d, { ...F, concursoId: 'A' })
    const b = sessoesFiltradas(d, { ...F, concursoId: 'B' })
    expect(a.reduce((t, s) => t + s.duracaoSeg, 0)).toBe(3600)
    expect(b.reduce((t, s) => t + s.duracaoSeg, 0)).toBe(1800)
    const geral = calcularIndicadores(d, F, conf, HOJE).segundos
    expect(geral).toBe(3600 + 1800 + 600)
  })

  it('bloco associado a dois concursos conta uma única vez no total geral', () => {
    const geral = totaisQuestoes(questoesFiltradas(d, F))
    expect(geral).toMatchObject({ total: 40, acertos: 23, erros: 17 })
  })

  it('bloco compartilhado aparece na visão de cada concurso associado, sem vazar para outros', () => {
    expect(totaisQuestoes(questoesFiltradas(d, { ...F, concursoId: 'A' }))).toMatchObject({ total: 20, acertos: 13 })
    expect(totaisQuestoes(questoesFiltradas(d, { ...F, concursoId: 'B' }))).toMatchObject({ total: 30, acertos: 15 })
    expect(questoesFiltradas(d, { ...F, concursoId: 'C' })).toHaveLength(0)
  })
})

describe('disciplinas compartilhadas', () => {
  it('a mesma disciplina soma dados de concursos diferentes só quando sem filtro, e separa com filtro', () => {
    const d = dados({
      disciplinas: [disciplina({ id: 'const', nome: 'Direito Constitucional' })],
      sessoes: [
        sessao({ concursoId: 'A', disciplinaId: 'const', duracaoSeg: 3600 }),
        sessao({ concursoId: 'B', disciplinaId: 'const', duracaoSeg: 7200 })
      ],
      questoes: [bloco({ concursoIds: ['A'], disciplinaId: 'const', total: 10, acertos: 9 }), bloco({ concursoIds: ['B'], disciplinaId: 'const', total: 10, acertos: 4 })]
    })
    const todos = desempenhoPorDisciplina(d, F)
    expect(todos).toHaveLength(1)
    expect(todos[0]).toMatchObject({ nome: 'Direito Constitucional', segundos: 10800, total: 20, acertos: 13 })
    expect(desempenhoPorDisciplina(d, { ...F, concursoId: 'A' })[0]).toMatchObject({ segundos: 3600, total: 10, acertos: 9, aproveitamento: 90 })
    expect(desempenhoPorDisciplina(d, { ...F, concursoId: 'B' })[0]).toMatchObject({ segundos: 7200, total: 10, acertos: 4, aproveitamento: 40 })
  })
})

describe('classificação de dias (mapa de consistência)', () => {
  const d = dados({
    sessoes: [
      sessao({ data: '2026-03-02', duracaoSeg: 3600 }), // meta 60min → concluído
      sessao({ data: '2026-03-03', duracaoSeg: 900 }) // parcial
    ],
    atividades: [atividade({ dataPlanejada: '2026-03-04', status: 'pulada' }), atividade({ dataPlanejada: '2026-03-05', status: 'pendente' })],
    marcacoesDia: [{ data: '2026-03-06', tipo: 'pulado', motivo: '' }]
  })
  const ctx = construirContextoDias(d, {}, conf, HOJE)

  it('classifica concluído, parcial, pulado, sem registro e futuro', () => {
    expect(classificarDia('2026-03-02', ctx)).toBe('concluido')
    expect(classificarDia('2026-03-03', ctx)).toBe('parcial')
    expect(classificarDia('2026-03-04', ctx)).toBe('pulado') // atividade pulada explicitamente
    expect(classificarDia('2026-03-06', ctx)).toBe('pulado') // marcação explícita
    expect(classificarDia('2026-03-20', ctx)).toBe('futuro')
  })

  it('dia sem registro NÃO é tratado como pulado (mesmo com atividade pendente)', () => {
    expect(classificarDia('2026-03-05', ctx)).toBe('sem_registro')
    expect(classificarDia('2026-03-09', ctx)).toBe('sem_registro')
  })

  it('registro de estudo prevalece sobre marcação de dia pulado', () => {
    const d2 = dados({ sessoes: [sessao({ data: '2026-03-06', duracaoSeg: 600 })], marcacoesDia: [{ data: '2026-03-06', tipo: 'pulado', motivo: '' }] })
    expect(classificarDia('2026-03-06', construirContextoDias(d2, {}, conf, HOJE))).toBe('parcial')
  })

  it('concluir tudo o que estava previsto também torna o dia concluído', () => {
    const d3 = dados({
      sessoes: [sessao({ data: '2026-03-09', duracaoSeg: 600 })],
      atividades: [atividade({ dataPlanejada: '2026-03-09', status: 'concluida', dataRealizacao: '2026-03-09' })]
    })
    expect(classificarDia('2026-03-09', construirContextoDias(d3, {}, conf, HOJE))).toBe('concluido')
  })
})

describe('metas não são retroativas', () => {
  const metas: MetaVigente[] = [
    { desde: '0000-01-01', metaDiariaMin: 60, metaSemanalMin: 300, metaQuestoesDia: 10 },
    { desde: '2026-03-10', metaDiariaMin: 120, metaSemanalMin: 600, metaQuestoesDia: 20 }
  ]
  it('datas anteriores continuam usando a meta antiga', () => {
    expect(metaVigente(metas, '2026-03-09').metaDiariaMin).toBe(60)
    expect(metaVigente(metas, '2026-03-10').metaDiariaMin).toBe(120)
  })
  it('um dia de 90 min foi "concluído" antes da mudança mas é "parcial" depois', () => {
    const d = dados({ sessoes: [sessao({ data: '2026-03-09', duracaoSeg: 5400 }), sessao({ data: '2026-03-10', duracaoSeg: 5400 })] })
    const ctx = construirContextoDias(d, {}, { ...conf, metas }, HOJE)
    expect(classificarDia('2026-03-09', ctx)).toBe('concluido')
    expect(classificarDia('2026-03-10', ctx)).toBe('parcial')
  })
})

describe('indicadores de relatório', () => {
  const semana = { de: '2026-03-02', ate: '2026-03-08' } // seg–dom
  const d = dados({
    concursos: [concurso({ id: 'A' })],
    sessoes: [sessao({ data: '2026-03-02', duracaoSeg: 3600 }), sessao({ data: '2026-03-04', duracaoSeg: 1800 }), sessao({ data: '2026-03-04', duracaoSeg: 1800 })],
    questoes: [bloco({ data: '2026-03-02', total: 10, acertos: 6 }), bloco({ data: '2026-03-02', total: 10, acertos: 8 })],
    erros: [erro({ statusRevisao: 'pendente' }), erro({ statusRevisao: 'revisado' }), erro({ arquivado: true })],
    cartoes: [cartao({ proximaRevisao: 1 }), cartao({ proximaRevisao: Date.now() + 10 ** 9 })],
    atividades: [atividade({ dataPlanejada: '2026-03-03', status: 'pulada' })]
  })
  const ind = calcularIndicadores(d, semana, conf, HOJE)

  it('horas, média diária, dias estudados e pulados', () => {
    expect(ind.horas).toBeCloseTo(2, 5)
    expect(ind.diasEstudados).toBe(2) // 02 e 04 (duas sessões no mesmo dia contam um dia)
    expect(ind.diasPulados).toBe(1) // 03 (atividade pulada)
    expect(ind.mediaDiariaSeg).toBeCloseTo(7200 / 7, 3)
  })
  it('questões, acertos, erros e aproveitamento', () => {
    expect(ind.questoes).toMatchObject({ total: 20, acertos: 14, erros: 6, aproveitamento: 70 })
  })
  it('consistência usa dias disponíveis decorridos (seg–sex = 5)', () => {
    expect(ind.diasPrevistos).toBe(5)
    expect(ind.diasPrevistosEstudados).toBe(2)
    expect(ind.consistencia).toBeCloseTo(40, 5)
  })
  it('erros pendentes (ignora arquivados e revisados) e revisões vencidas', () => {
    expect(ind.errosPendentes).toBe(1)
    expect(ind.revisoesVencidas).toBe(1)
  })
  it('metas do período consideram só dias disponíveis já decorridos', () => {
    expect(ind.metaSegundos).toBe(5 * 3600)
    expect(ind.metaQuestoes).toBe(50)
  })
})

describe('relatórios por período e séries', () => {
  const d = dados({
    sessoes: [sessao({ data: '2026-03-02', duracaoSeg: 3600 }), sessao({ data: '2026-03-10', duracaoSeg: 7200 })],
    questoes: [bloco({ data: '2026-03-02', total: 10, acertos: 5 }), bloco({ data: '2026-03-10', total: 10, acertos: 9 })]
  })
  it('semanal: horas por dia cobrem todos os dias do intervalo', () => {
    const serie = horasPorPeriodo(d, { de: '2026-03-02', ate: '2026-03-08' })
    expect(serie).toHaveLength(7)
    expect(serie[0].valor).toBe(1)
    expect(serie[1].valor).toBe(0)
  })
  it('mensal: agrupa por semana e soma corretamente', () => {
    const serie = horasPorPeriodo(d, { de: '2026-03-01', ate: '2026-03-31' }, 'semana')
    expect(serie.reduce((t, p) => t + p.valor, 0)).toBe(3)
    const q = questoesPorPeriodo(d, { de: '2026-03-01', ate: '2026-03-31' }, 'semana')
    expect(q.reduce((t, p) => t + p.total, 0)).toBe(20)
    expect(q.find((p) => p.total > 0)?.aproveitamento).toBe(50)
  })
  it('consistência semanal marca semana em andamento como parcial', () => {
    // semanas começam no domingo: 01–07 (completa) e 08–14 (inclui dias futuros)
    const c = consistenciaPorPeriodo(d, { de: '2026-03-01', ate: '2026-03-14' }, conf, HOJE, 'semana')
    expect(c).toHaveLength(2)
    expect(c[0].parcial).toBe(false)
    expect(c[1].parcial).toBe(true)
  })
})

describe('comparação de períodos e análises', () => {
  it('período incompleto é comparado só pelos mesmos dias decorridos', () => {
    const p = periodosComparaveis({ de: '2026-03-01', ate: '2026-03-31' }, HOJE)!
    expect(p.parcial).toBe(true)
    expect(p.dias).toBe(11)
    expect(p.atual).toMatchObject({ de: '2026-03-01', ate: HOJE })
    expect(p.anterior).toMatchObject({ de: '2026-01-29', ate: '2026-02-08' })
  })
  it('período completo compara com o período imediatamente anterior de mesmo tamanho', () => {
    const p = periodosComparaveis({ de: '2026-03-02', ate: '2026-03-08' }, HOJE)!
    expect(p.parcial).toBe(false)
    expect(p.anterior).toMatchObject({ de: '2026-02-23', ate: '2026-03-01' })
  })
  it('período totalmente no futuro não é comparável', () => {
    expect(periodosComparaveis({ de: '2026-04-01', ate: '2026-04-07' }, HOJE)).toBeNull()
  })

  const base = dados({
    concursos: [concurso({ id: 'A', status: 'preparacao' })],
    disciplinas: [disciplina({ id: 'port', nome: 'Português' }), disciplina({ id: 'adm', nome: 'Administrativo' }), disciplina({ id: 'inf', nome: 'Informática' })],
    concursoDisciplinas: [
      { id: '1', concursoId: 'A', disciplinaId: 'port', ordem: 0 },
      { id: '2', concursoId: 'A', disciplinaId: 'adm', ordem: 1 },
      { id: '3', concursoId: 'A', disciplinaId: 'inf', ordem: 2 }
    ],
    sessoes: [sessao({ concursoId: 'A', disciplinaId: 'port', data: '2026-03-03', duracaoSeg: 3600 })],
    questoes: [
      bloco({ concursoIds: ['A'], disciplinaId: 'port', data: '2026-03-03', total: 20, acertos: 8 }), // 40% → baixo
      bloco({ concursoIds: ['A'], disciplinaId: 'port', data: '2026-02-26', total: 20, acertos: 16 }), // anterior 80%
      bloco({ concursoIds: ['A'], disciplinaId: 'adm', data: '2026-03-04', total: 20, acertos: 18 }),
      bloco({ concursoIds: ['A'], disciplinaId: 'adm', data: '2026-02-25', total: 20, acertos: 10 })
    ]
  })
  const semana = { de: '2026-03-02', ate: '2026-03-08' }

  it('compara disciplinas entre períodos com variação em pontos percentuais', () => {
    const p = periodosComparaveis(semana, HOJE)!
    const linhas = compararDisciplinas(base, p)
    expect(linhas.find((l) => l.nome === 'Português')!.deltaAproveitamento).toBeCloseTo(-40, 5)
    expect(linhas.find((l) => l.nome === 'Administrativo')!.deltaAproveitamento).toBeCloseTo(40, 5)
  })

  it('insights trazem os dados que sustentam cada conclusão', () => {
    const ins = gerarInsights(base, { ...semana, concursoId: 'A' }, conf, HOJE)
    const baixo = ins.find((i) => i.tipo === 'baixo_aproveitamento')!
    expect(baixo.titulo).toContain('Português')
    expect(baixo.detalhe).toContain('8 acertos em 20 questões')
    expect(ins.find((i) => i.tipo === 'queda')!.detalhe).toContain('40%')
    expect(ins.find((i) => i.tipo === 'melhora')!.titulo).toContain('Administrativo')
    const negl = ins.filter((i) => i.tipo === 'negligenciada').map((i) => i.titulo)
    expect(negl.some((t) => t.includes('Informática'))).toBe(true)
    expect(negl.some((t) => t.includes('Português'))).toBe(false)
  })

  it('não conclui nada com poucas questões', () => {
    const poucos = dados({ ...base, questoes: [bloco({ concursoIds: ['A'], disciplinaId: 'port', data: '2026-03-03', total: 4, acertos: 0 })] })
    const ins = gerarInsights(poucos, { ...semana, concursoId: 'A' }, conf, HOJE)
    expect(ins.some((i) => i.tipo === 'baixo_aproveitamento')).toBe(false)
  })

  it('tópicos mais difíceis exigem amostra mínima', () => {
    const d = dados({
      disciplinas: [disciplina({ id: 'port', nome: 'Português' })],
      topicos: [
        { id: 't1', disciplinaId: 'port', nome: 'Crase', ordem: 0, status: 'nao_iniciado', observacoes: '' },
        { id: 't2', disciplinaId: 'port', nome: 'Concordância', ordem: 1, status: 'nao_iniciado', observacoes: '' }
      ],
      questoes: [
        bloco({ disciplinaId: 'port', topicoId: 't1', total: 10, acertos: 3 }),
        bloco({ disciplinaId: 'port', topicoId: 't2', total: 2, acertos: 0 })
      ]
    })
    const r = topicosMaisDificeis(d, F)
    expect(r.map((x) => x.nome)).toEqual(['Crase'])
  })
})
