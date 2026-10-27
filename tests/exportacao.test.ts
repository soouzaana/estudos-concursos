import { describe, expect, it } from 'vitest'
import {
  CAPACIDADE_PADRAO, intervaloDoPeriodo, montarPlanner, nomeBase, paginarPorCapacidade, paginarPorSemana, selecionarAtividades,
  validarOpcoes, type BlocoDia, type DadosPlanner, type OpcoesExportacao
} from '@/services/exportacao'
import { atividade, concurso, disciplina } from './fabricas'
import { configPadrao } from '@/services/configuracoes'

const c1 = concurso({ id: 'c1', nome: 'TJ-RO 2026 Ç', cargo: 'Analista', orgao: 'TJ' })
const c2 = concurso({ id: 'c2', nome: 'Outro' })
const d1 = disciplina({ id: 'd1', nome: 'Português', cor: '#ff0000' })

function dados(atividades = [] as ReturnType<typeof atividade>[]): DadosPlanner {
  return { concursos: [c1, c2], disciplinas: [d1], topicos: [], atividades, metas: configPadrao().metas }
}
const base: OpcoesExportacao = {
  concursoId: 'c1', periodo: 'semana', de: '2026-03-01', ate: '2026-03-07', horarios: true, metas: true, status: true, formato: 'pdf', orientacao: 'retrato'
}
const at = (p: Partial<ReturnType<typeof atividade>>) => atividade({ concursoId: 'c1', disciplinaId: 'd1', ...p })

describe('exportação do cronograma — montagem', () => {
  it('períodos padrão: dia, semana (dom–sáb) e mês', () => {
    expect(intervaloDoPeriodo('dia', '2026-03-04')).toEqual({ de: '2026-03-04', ate: '2026-03-04' })
    expect(intervaloDoPeriodo('semana', '2026-03-04')).toEqual({ de: '2026-03-01', ate: '2026-03-07' })
    expect(intervaloDoPeriodo('mes', '2026-02-10')).toEqual({ de: '2026-02-01', ate: '2026-02-28' })
  })

  it('valida datas e limite de período', () => {
    expect(validarOpcoes({ de: '2026-03-05', ate: '2026-03-01' })).toMatch(/anterior/)
    expect(validarOpcoes({ de: '', ate: '2026-03-01' })).toMatch(/datas/)
    expect(validarOpcoes({ de: '2025-01-01', ate: '2026-12-31' })).toMatch(/366/)
    expect(validarOpcoes({ de: '2026-03-01', ate: '2026-03-07' })).toBeNull()
  })

  it('seleciona só o concurso e o período pedidos, usando a data efetiva (reagendamento)', () => {
    const lista = [
      at({ id: 'a', dataPlanejada: '2026-03-02' }),
      at({ id: 'b', dataPlanejada: '2026-02-20', reagendadaPara: '2026-03-03' }),
      at({ id: 'c', dataPlanejada: '2026-03-02', reagendadaPara: '2026-03-20' }),
      at({ id: 'd', dataPlanejada: '2026-03-02', concursoId: 'c2' }),
      at({ id: 'e', dataPlanejada: '2026-03-08' })
    ]
    const sel = selecionarAtividades(dados(lista), base).map((a) => a.id)
    expect(sel).toEqual(['a', 'b'])
    expect(selecionarAtividades(dados(lista), { ...base, concursoId: undefined }).map((a) => a.id)).toEqual(['a', 'd', 'b'])
  })

  it('não altera os dados originais', () => {
    const lista = [at({ id: 'a', dataPlanejada: '2026-03-02', status: 'pulada' })]
    const antes = JSON.stringify(lista)
    montarPlanner(base, dados(lista))
    expect(JSON.stringify(lista)).toBe(antes)
  })

  it('traz título, concurso/cargo, dias da semana, disciplina, horário, duração e status', () => {
    const [p] = montarPlanner(base, dados([at({ dataPlanejada: '2026-03-02', horario: '08:30', duracaoMin: 90, status: 'concluida', questoesPrevistas: 10 })]))
    expect(p.titulo).toBe('Planner semanal')
    expect(p.subtitulo).toBe('TJ-RO 2026 Ç · Analista · TJ')
    expect(p.blocos).toHaveLength(7) // semana mostra todos os dias, inclusive livres
    const seg = p.blocos.find((b) => b.data === '2026-03-02')!
    expect(seg.diaLongo).toBe('segunda-feira')
    expect(seg.linhas[0]).toMatchObject({ disciplina: 'Português', horario: '08:30', duracao: '1 h 30 min', statusRotulo: 'Concluída', questoes: 10, cor: '#ff0000' })
  })

  it('respeita as opções de incluir horários, metas e status', () => {
    const dd = dados([at({ dataPlanejada: '2026-03-02', duracaoMin: 60, questoesPrevistas: 5 })])
    const [com] = montarPlanner(base, dd)
    expect(com.metas).toMatchObject({ atividades: 1, minutosPrevistos: 60, questoesPrevistas: 5, metaDiariaMin: 120, metaSemanalMin: 600 })
    const [sem] = montarPlanner({ ...base, horarios: false, metas: false, status: false }, dd)
    expect(sem.metas).toBeUndefined()
    expect(sem.incluirHorarios).toBe(false)
    expect(sem.incluirStatus).toBe(false)
  })

  it('mensal mostra só dias com atividades; período sem atividades gera uma página vazia', () => {
    const mensal = { ...base, periodo: 'mes' as const, de: '2026-03-01', ate: '2026-03-31' }
    const [p] = montarPlanner(mensal, dados([at({ dataPlanejada: '2026-03-10' }), at({ dataPlanejada: '2026-03-20' })]))
    expect(p.blocos.map((b) => b.data)).toEqual(['2026-03-10', '2026-03-20'])
    const vazio = montarPlanner(mensal, dados([]))
    expect(vazio).toHaveLength(1)
    expect(vazio[0].vazia).toBe(true)
  })

  it('mostra o nome do concurso por linha quando exporta todos', () => {
    const [p] = montarPlanner({ ...base, concursoId: undefined }, dados([at({ dataPlanejada: '2026-03-02' })]))
    expect(p.mostrarConcurso).toBe(true)
    expect(p.subtitulo).toBe('Todos os concursos')
    expect(p.blocos.find((b) => b.data === '2026-03-02')!.linhas[0].concurso).toBe('TJ-RO 2026 Ç')
  })

  it('gera nomes de arquivo seguros', () => {
    expect(nomeBase(base, [c1, c2])).toBe('cronograma-tj-ro-2026-c-2026-03-01_a_2026-03-07')
    expect(nomeBase({ ...base, concursoId: undefined }, [c1])).toBe('cronograma-todos-2026-03-01_a_2026-03-07')
  })
})

describe('exportação do cronograma — paginação sem cortar conteúdo', () => {
  const bloco = (data: string, n: number): BlocoDia => ({
    data, diaLongo: '', diaCurto: '', dataCurta: '', continuacao: false,
    linhas: Array.from({ length: n }, (_, i) => ({ id: `${data}-${i}`, disciplina: 'x', cor: '#000', topico: '', duracao: '', questoes: 0, status: 'pendente' as const, statusRotulo: '', reagendada: false }))
  })
  const linhas = (pg: BlocoDia[][]) => pg.map((p) => p.reduce((s, b) => s + b.linhas.length, 0))

  it('nunca perde nem duplica atividades', () => {
    const blocos = Array.from({ length: 30 }, (_, i) => bloco(`2026-03-${String(i + 1).padStart(2, '0')}`, (i % 5) + 1))
    const total = blocos.reduce((s, b) => s + b.linhas.length, 0)
    for (const cap of [8, 14, 24]) {
      const paginas = paginarPorCapacidade(blocos, cap)
      expect(linhas(paginas).reduce((a, b) => a + b, 0)).toBe(total)
      expect(new Set(paginas.flat().flatMap((b) => b.linhas.map((l) => l.id))).size).toBe(total)
    }
  })

  it('divide em várias páginas respeitando a capacidade', () => {
    const blocos = Array.from({ length: 7 }, (_, i) => bloco(`2026-03-0${i + 1}`, 4))
    const paginas = paginarPorCapacidade(blocos, CAPACIDADE_PADRAO.paisagem)
    expect(paginas.length).toBeGreaterThan(1)
    for (const p of paginas) expect(p.reduce((s, b) => s + 1.6 + b.linhas.length, 0)).toBeLessThanOrEqual(CAPACIDADE_PADRAO.paisagem)
  })

  it('um dia maior que a página continua na seguinte, marcado como continuação', () => {
    const paginas = paginarPorCapacidade([bloco('2026-03-02', 40)], 14)
    expect(paginas.length).toBeGreaterThan(2)
    expect(paginas[0][0].continuacao).toBe(false)
    expect(paginas[1][0].continuacao).toBe(true)
    expect(linhas(paginas).reduce((a, b) => a + b, 0)).toBe(40)
  })

  it('PNG: uma imagem por semana', () => {
    const blocos = ['2026-03-02', '2026-03-04', '2026-03-09', '2026-03-24'].map((d) => bloco(d, 1))
    const semanas = paginarPorSemana(blocos)
    expect(semanas.map((s) => s.map((b) => b.data))).toEqual([['2026-03-02', '2026-03-04'], ['2026-03-09'], ['2026-03-24']])
    const paginas = montarPlanner({ ...base, formato: 'png', periodo: 'mes', de: '2026-03-01', ate: '2026-03-31' }, dados([
      at({ dataPlanejada: '2026-03-02' }), at({ dataPlanejada: '2026-03-10' }), at({ dataPlanejada: '2026-03-24' })
    ]))
    expect(paginas).toHaveLength(3)
    expect(paginas.map((p) => `${p.numero}/${p.total}`)).toEqual(['1/3', '2/3', '3/3'])
  })

  it('a montagem recusa períodos inválidos', () => {
    expect(() => montarPlanner({ ...base, de: '2026-03-09', ate: '2026-03-01' }, dados())).toThrow()
  })
})
