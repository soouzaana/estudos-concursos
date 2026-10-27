import { beforeEach, describe, expect, it } from 'vitest'
import { BancoEstudos, NOME_BANCO, banco, substituirBanco } from '@/db/database'
import * as repo from '@/db/repositorio'
import { atividade, bloco, cartao, concurso, disciplina, erro, sessao } from './fabricas'

let n = 0
beforeEach(async () => {
  const novo = new BancoEstudos(`teste-${++n}-${Math.random()}`)
  substituirBanco(novo)
  await novo.open()
})

describe('persistência no IndexedDB', () => {
  it('grava e relê concursos, disciplinas e vínculos após reabrir o banco', async () => {
    const nome = banco.name
    const c = concurso({ id: 'c1', nome: 'TRT' })
    const d = disciplina({ id: 'd1', nome: 'Português' })
    await repo.salvarDisciplina(d)
    await repo.salvarConcurso(c, ['d1'])
    banco.close()
    const reaberto = new BancoEstudos(nome)
    substituirBanco(reaberto)
    const tudo = await repo.carregarTudo()
    expect(tudo.concursos.map((x) => x.nome)).toEqual(['TRT'])
    expect(tudo.disciplinas).toHaveLength(1)
    expect(tudo.concursoDisciplinas).toHaveLength(1)
  })

  it('disciplina compartilhada é cadastrada uma vez e vinculada a vários concursos', async () => {
    await repo.salvarDisciplina(disciplina({ id: 'dc', nome: 'Direito Constitucional' }))
    await repo.salvarConcurso(concurso({ id: 'A' }), ['dc'])
    await repo.salvarConcurso(concurso({ id: 'B' }), ['dc'])
    await repo.vincularDisciplina('B', 'dc') // idempotente
    const tudo = await repo.carregarTudo()
    expect(tudo.disciplinas).toHaveLength(1)
    expect(tudo.concursoDisciplinas.filter((r) => r.disciplinaId === 'dc')).toHaveLength(2)
  })

  it('excluir concurso preserva o histórico e só remove a associação', async () => {
    await repo.salvarDisciplina(disciplina({ id: 'd1' }))
    await repo.salvarConcurso(concurso({ id: 'A' }), ['d1'])
    await repo.salvarConcurso(concurso({ id: 'B' }), ['d1'])
    await repo.salvarAtividade(atividade({ id: 'at1', concursoId: 'A', disciplinaId: 'd1' }))
    await repo.salvarSessao(sessao({ id: 's1', concursoId: 'A', disciplinaId: 'd1' }))
    await repo.salvarBlocoQuestoes(bloco({ id: 'q1', concursoIds: ['A', 'B'], disciplinaId: 'd1' }))
    await repo.salvarErro(erro({ id: 'e1', concursoIds: ['A', 'B'], disciplinaId: 'd1' }))
    await repo.excluirConcurso('A')
    const t = await repo.carregarTudo()
    expect(t.concursos.map((c) => c.id)).toEqual(['B'])
    expect(t.atividades).toHaveLength(0)
    expect(t.sessoes).toHaveLength(1)
    expect(t.sessoes[0].concursoId).toBeUndefined()
    expect(t.questoes[0].concursoIds).toEqual(['B'])
    expect(t.erros[0].concursoIds).toEqual(['B'])
  })

  it('disciplina com histórico é arquivada, não apagada; sem histórico é excluída', async () => {
    await repo.salvarDisciplina(disciplina({ id: 'com' }))
    await repo.salvarDisciplina(disciplina({ id: 'sem' }))
    await repo.salvarBlocoQuestoes(bloco({ disciplinaId: 'com' }))
    expect(await repo.excluirDisciplina('com')).toBe('arquivada')
    expect(await repo.excluirDisciplina('sem')).toBe('excluida')
    const t = await repo.carregarTudo()
    expect(t.disciplinas.map((d) => [d.id, d.arquivada])).toEqual([['com', true]])
    await repo.restaurarDisciplina('com')
    expect((await repo.carregarTudo()).disciplinas[0].arquivada).toBe(false)
  })

  it('cronômetro e configurações sobrevivem a recarregar', async () => {
    const estado = { metodo: 'teoria' as const, observacoes: '', iniciadoEm: 1000, status: 'rodando' as const, acumuladoMs: 0, retomadoEm: 1000 }
    await repo.gravarCronometro(estado)
    expect(await repo.lerCronometro()).toEqual(estado)
    await repo.limparCronometro()
    expect(await repo.lerCronometro()).toBeUndefined()
  })

  it('registrar revisão de cartão é atômico (cartão + histórico)', async () => {
    const c = cartao({ id: 'k1' })
    await repo.salvarCartao(c)
    await repo.registrarRevisaoCartao({ ...c, proximaRevisao: 99 }, {
      id: 'r1', cartaoId: 'k1', em: 1, data: '2026-03-02', nota: 'bom', estadoAnterior: 0, estadoNovo: 2, intervaloDias: 1
    })
    const t = await repo.carregarTudo()
    expect(t.cartoes[0].proximaRevisao).toBe(99)
    expect(t.revisoesCartao).toHaveLength(1)
    await repo.excluirCartao('k1')
    const depois = await repo.carregarTudo()
    expect(depois.cartoes).toHaveLength(0)
    expect(depois.revisoesCartao).toHaveLength(0)
  })

  it('usa o nome de banco esperado e o esquema versão 1', () => {
    expect(NOME_BANCO).toBe('estudos-concursos-db')
    expect(new BancoEstudos('x').verno).toBe(1)
  })
})
