import { beforeEach, describe, expect, it } from 'vitest'
import { BancoEstudos, banco, substituirBanco } from '@/db/database'
import * as repo from '@/db/repositorio'
import {
  FORMATO_ATUAL, lerBackup, migrarBackup, montarBackup, nomeArquivoBackup, restaurarBackup, serializarBackup, type Migracao
} from '@/services/backup'
import { atividade, bloco, cartao, concurso, disciplina, erro, sessao } from './fabricas'

let n = 0
beforeEach(async () => {
  const novo = new BancoEstudos(`bkp-${++n}-${Math.random()}`)
  substituirBanco(novo)
  await novo.open()
})

async function popular() {
  await repo.salvarDisciplina(disciplina({ id: 'd1', nome: 'Português' }))
  await repo.salvarConcurso(concurso({ id: 'c1', nome: 'TRT' }), ['d1'])
  await repo.salvarAtividade(atividade({ id: 'a1', concursoId: 'c1', disciplinaId: 'd1' }))
  await repo.salvarSessao(sessao({ id: 's1', concursoId: 'c1', disciplinaId: 'd1' }))
  await repo.salvarBlocoQuestoes(bloco({ id: 'q1', concursoIds: ['c1'], disciplinaId: 'd1', total: 10, acertos: 6 }))
  await repo.salvarErro(erro({ id: 'e1', concursoIds: ['c1'], disciplinaId: 'd1' }))
  await repo.salvarCartao(cartao({ id: 'k1', concursoIds: ['c1'] }))
  await repo.gravarConfiguracoes({ ...(await import('@/services/configuracoes')).configPadrao(), paleta: 'azul' })
}

describe('backup e restauração', () => {
  it('exporta e reimporta todos os dados (ida e volta idêntica)', async () => {
    await popular()
    const texto = serializarBackup(await montarBackup(new Date('2026-03-02T12:00:00Z')))
    const lido = lerBackup(texto)
    expect(lido.ok).toBe(true)
    expect(lido.contagens.concursos).toBe(1)
    expect(lido.contagens.erros).toBe(1)
    await repo.apagarTudo()
    expect((await repo.carregarTudo()).concursos).toHaveLength(0)
    await restaurarBackup(lido.backup!)
    const t = await repo.carregarTudo()
    expect(t.concursos[0].nome).toBe('TRT')
    expect(t.questoes[0].acertos).toBe(6)
    expect(t.cartoes).toHaveLength(1)
    expect((await repo.lerConfiguracoes())?.paleta).toBe('azul')
  })

  it('o backup traz versão do formato e não inclui o cronômetro em andamento', async () => {
    await repo.gravarCronometro({ metodo: 'teoria', observacoes: '', iniciadoEm: 1, status: 'rodando', acumuladoMs: 0, retomadoEm: 1 })
    const b = await montarBackup()
    expect(b.formatoVersao).toBe(FORMATO_ATUAL)
    expect(b.app).toBe('estudos-concursos')
    expect(b.config.cronometro).toBeUndefined()
  })

  it('rejeita JSON inválido, outro aplicativo e estruturas inesperadas', () => {
    expect(lerBackup('{quebrado').ok).toBe(false)
    expect(lerBackup('[]').ok).toBe(false)
    expect(lerBackup(JSON.stringify({ app: 'outro', formatoVersao: 1 })).ok).toBe(false)
    expect(lerBackup(JSON.stringify({ app: 'estudos-concursos', formatoVersao: 1 })).ok).toBe(false)
  })

  it('rejeita tipos errados e valores inconsistentes, listando os problemas', async () => {
    await popular()
    const b = JSON.parse(serializarBackup(await montarBackup()))
    b.dados.questoes[0].acertos = 99
    b.dados.concursos[0].status = 'inventado'
    b.dados.sessoes[0].duracaoSeg = 'muito'
    const r = lerBackup(JSON.stringify(b))
    expect(r.ok).toBe(false)
    expect(r.erros.join(' ')).toMatch(/acertos maiores/)
    expect(r.erros.join(' ')).toMatch(/concursos\[0\]\.status/)
    expect(r.erros.join(' ')).toMatch(/sessoes\[0\]\.duracaoSeg/)
  })

  it('rejeita identificadores duplicados', async () => {
    await popular()
    const b = JSON.parse(serializarBackup(await montarBackup()))
    b.dados.concursos.push({ ...b.dados.concursos[0] })
    const r = lerBackup(JSON.stringify(b))
    expect(r.ok).toBe(false)
    expect(r.erros.join(' ')).toMatch(/duplicado/)
  })

  it('rejeita referências quebradas', async () => {
    await popular()
    const b = JSON.parse(serializarBackup(await montarBackup()))
    b.dados.atividades[0].disciplinaId = 'nao-existe'
    const r = lerBackup(JSON.stringify(b))
    expect(r.ok).toBe(false)
    expect(r.erros.join(' ')).toMatch(/disciplina inexistente/)
  })

  it('arquivo inválido NÃO altera os dados existentes', async () => {
    await popular()
    const antes = await repo.carregarTudo()
    const r = lerBackup('{"app":"estudos-concursos","formatoVersao":1,"dados":{"concursos":"x"}}')
    expect(r.ok).toBe(false)
    expect(r.backup).toBeUndefined()
    expect(await repo.carregarTudo()).toEqual(antes)
  })

  it('falha no meio da restauração reverte tudo (transação atômica)', async () => {
    await popular()
    const antes = await repo.carregarTudo()
    const ruim = { ...(await montarBackup()) }
    // Duas linhas com a mesma chave primária: o bulkAdd falha e a transação deve ser revertida.
    ruim.dados = { ...ruim.dados, concursos: [concurso({ id: 'x' }), concurso({ id: 'x' })] }
    await expect(restaurarBackup(ruim)).rejects.toBeDefined()
    expect(await repo.carregarTudo()).toEqual(antes)
    expect((await repo.lerConfiguracoes())?.paleta).toBe('azul')
  })

  it('restaurar preserva o cronômetro que estiver em andamento', async () => {
    const b = await montarBackup()
    const est = { metodo: 'teoria' as const, observacoes: '', iniciadoEm: 5, status: 'rodando' as const, acumuladoMs: 0, retomadoEm: 5 }
    await repo.gravarCronometro(est)
    await restaurarBackup(b)
    expect(await repo.lerCronometro()).toEqual(est)
  })

  it('tolera tabelas ausentes com aviso e normaliza configurações inválidas', () => {
    const r = lerBackup(JSON.stringify({
      app: 'estudos-concursos', formatoVersao: 1, exportadoEm: 'x',
      dados: { concursos: [] }, config: { configuracoes: { modo: 'xyz', retencaoDesejada: 5 } }
    }))
    expect(r.ok).toBe(true)
    expect(r.avisos.length).toBeGreaterThan(0)
    const cfg = r.backup!.config.configuracoes as { modo: string; retencaoDesejada: number }
    expect(cfg.modo).toBe('automatico')
    expect(cfg.retencaoDesejada).toBe(0.99)
  })

  it('gera nome de arquivo com data e hora', () => {
    expect(nomeArquivoBackup(new Date(2026, 2, 2, 8, 5))).toBe('backup-estudos-concursos-20260302-0805.json')
  })
})

describe('migração de formato de backup', () => {
  const base = { app: 'estudos-concursos', formatoVersao: 1, dados: {} }
  const m12: Migracao = (b) => ({ ...b, formatoVersao: 2, migrado: true })
  const m23: Migracao = (b) => ({ ...b, formatoVersao: 3 })

  it('aplica migrações em cadeia até o formato alvo', () => {
    const r = migrarBackup({ ...base }, { 1: m12, 2: m23 }, 3)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.backup.formatoVersao).toBe(3)
      expect(r.backup.migrado).toBe(true)
    }
  })
  it('recusa backups de versão mais nova que o app', () => {
    const r = migrarBackup({ ...base, formatoVersao: 9 }, {}, 2)
    expect(r.ok).toBe(false)
  })
  it('recusa quando falta uma migração intermediária ou versão inválida', () => {
    expect(migrarBackup({ ...base }, {}, 2).ok).toBe(false)
    expect(migrarBackup({ app: 'x' }, {}, 1).ok).toBe(false)
    expect(migrarBackup({ ...base, formatoVersao: 0 }, {}, 1).ok).toBe(false)
  })
  it('detecta migração que não avança a versão e erros dentro da migração', () => {
    expect(migrarBackup({ ...base }, { 1: (b) => b }, 2).ok).toBe(false)
    expect(migrarBackup({ ...base }, { 1: () => { throw new Error('boom') } }, 2).ok).toBe(false)
  })
  it('migra e valida via lerBackup com migrações injetadas', () => {
    const r = lerBackup(JSON.stringify({ app: 'estudos-concursos', formatoVersao: 1, dados: { concursos: [] } }), { 1: m12 }, 2)
    expect(r.ok).toBe(true)
    expect(r.versaoOriginal).toBe(1)
    expect(r.backup?.formatoVersao).toBe(2)
  })
})

describe('esquema do Dexie', () => {
  it('abre bancos novos sem perder dados ao reabrir', async () => {
    await repo.salvarDisciplina(disciplina({ id: 'persist' }))
    const nome = banco.name
    banco.close()
    const outro = new BancoEstudos(nome)
    substituirBanco(outro)
    expect((await repo.carregarTudo()).disciplinas[0].id).toBe('persist')
  })
})
