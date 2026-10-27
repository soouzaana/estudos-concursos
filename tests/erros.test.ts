import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { BancoEstudos, substituirBanco } from '@/db/database'
import { useDadosStore } from '@/stores/dados'
import { calcularErros } from '@/utils/validacao'
import { disciplina } from './fabricas'
import * as repo from '@/db/repositorio'

let n = 0
beforeEach(async () => {
  const novo = new BancoEstudos(`err-${++n}-${Math.random()}`)
  substituirBanco(novo)
  await novo.open()
  setActivePinia(createPinia())
  await repo.salvarDisciplina(disciplina({ id: 'd1' }))
})

const base = {
  enunciado: 'Qual o prazo?', alternativas: ['A) 5', 'B) 10'], respostaMarcada: 'A', respostaCorreta: 'B', explicacao: 'Art. 5º',
  motivo: 'esquecimento' as const, disciplinaId: 'd1', concursoIds: ['c1', 'c2'], fonte: 'Plataforma', data: '2026-03-02',
  dificuldade: 'media' as const, tags: ['prazos']
}

describe('caderno de erros', () => {
  it('um erro associado a dois concursos é guardado uma única vez', async () => {
    const dados = useDadosStore()
    await dados.carregar()
    await dados.salvarErro(base)
    expect(dados.erros).toHaveLength(1)
    expect(dados.erros[0].concursoIds).toEqual(['c1', 'c2'])
    expect(dados.erros[0].statusRevisao).toBe('pendente')
  })

  it('marcar como revisado registra o histórico de revisões; reabrir mantém o histórico', async () => {
    const dados = useDadosStore()
    await dados.carregar()
    const e = await dados.salvarErro(base)
    await dados.marcarErroRevisado(e.id, 'ok')
    expect(dados.erros[0].statusRevisao).toBe('revisado')
    expect(dados.erros[0].revisoes).toHaveLength(1)
    await dados.reabrirErro(e.id)
    expect(dados.erros[0].statusRevisao).toBe('pendente')
    expect(dados.erros[0].revisoes).toHaveLength(1)
  })

  it('arquivar não apaga o erro', async () => {
    const dados = useDadosStore()
    await dados.carregar()
    const e = await dados.salvarErro(base)
    await dados.arquivarErro(e.id)
    expect(dados.erros[0].arquivado).toBe(true)
  })

  it('transformar em flashcard copia o conteúdo, vincula a origem e não duplica', async () => {
    const dados = useDadosStore()
    await dados.carregar()
    const e = await dados.salvarErro(base)
    const c1 = await dados.criarCartaoDeErro(e.id)
    const c2 = await dados.criarCartaoDeErro(e.id)
    expect(c1?.origemErroId).toBe(e.id)
    expect(c1?.concursoIds).toEqual(['c1', 'c2'])
    expect(dados.cartoes).toHaveLength(1)
    expect(c2?.id).toBe(c1?.id)
  })

  it('excluir o erro mantém o flashcard, apenas sem a origem', async () => {
    const dados = useDadosStore()
    await dados.carregar()
    const e = await dados.salvarErro(base)
    await dados.criarCartaoDeErro(e.id)
    await dados.excluirErro(e.id)
    expect(dados.erros).toHaveLength(0)
    expect(dados.cartoes).toHaveLength(1)
    expect(dados.cartoes[0].origemErroId).toBeUndefined()
  })

  it('erros do bloco = total − acertos', () => {
    expect(calcularErros(20, 13)).toBe(7)
  })
})
