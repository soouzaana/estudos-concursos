import { describe, expect, it } from 'vitest'
import {
  concluirAtividade, dataEfetiva, estaAtrasada, gerarAtividadesSemanais, iniciarAtividade, ordenarAtividades,
  proximaAtividade, pularAtividade, progressoCronograma, reabrirAtividade, reagendarAtividade, reagendarAtrasadas,
  tempoRealizadoSeg
} from '@/services/cronograma'
import { atividade, sessao } from './fabricas'

describe('avanço do cronograma', () => {
  const seg = atividade({ id: 'seg', dataPlanejada: '2026-03-02', ordem: 0 })
  const ter = atividade({ id: 'ter', dataPlanejada: '2026-03-03', ordem: 1 })
  const qua = atividade({ id: 'qua', dataPlanejada: '2026-03-04', ordem: 2 })

  it('a próxima atividade é a primeira ainda aberta da sequência', () => {
    expect(proximaAtividade([qua, seg, ter])?.id).toBe('seg')
  })

  it('concluir registra data real de realização', () => {
    const t = concluirAtividade(seg, '2026-03-05')!
    expect(t.atividade.status).toBe('concluida')
    expect(t.atividade.dataRealizacao).toBe('2026-03-05')
    expect(t.atividade.dataPlanejada).toBe('2026-03-02')
    expect(proximaAtividade([t.atividade, ter, qua])?.id).toBe('ter')
  })

  it('pular marca como pulada, NÃO conclui e avança para a próxima', () => {
    const t = pularAtividade(seg)!
    expect(t.atividade.status).toBe('pulada')
    expect(t.atividade.dataRealizacao).toBeUndefined()
    expect(t.evento.tipo).toBe('pulada')
    const lista = [t.atividade, ter, qua]
    expect(proximaAtividade(lista)?.id).toBe('ter')
    // não é ocultada nem apagada
    expect(lista).toContain(t.atividade)
    expect(progressoCronograma(lista).concluidas).toBe(0)
    expect(progressoCronograma(lista).puladas).toBe(1)
  })

  it('não permite pular/concluir o que já foi encerrado', () => {
    const pulada = pularAtividade(seg)!.atividade
    expect(pularAtividade(pulada)).toBeNull()
    expect(concluirAtividade(pulada, '2026-03-05')).toBeNull()
    expect(reagendarAtividade(pulada, '2026-03-10')).toBeNull()
  })

  it('a passagem do tempo sozinha não altera status nem avança a sequência', () => {
    const hojeFuturo = '2026-04-01'
    expect(estaAtrasada(seg, hojeFuturo)).toBe(true)
    expect(seg.status).toBe('pendente')
    expect(proximaAtividade([seg, ter, qua])?.id).toBe('seg')
  })

  it('reagendar preserva a data planejada original e registra o histórico', () => {
    const t = reagendarAtividade(seg, '2026-03-10')!
    expect(t.atividade.dataPlanejada).toBe('2026-03-02')
    expect(t.atividade.reagendadaPara).toBe('2026-03-10')
    expect(dataEfetiva(t.atividade)).toBe('2026-03-10')
    expect(t.evento).toMatchObject({ tipo: 'reagendada', de: '2026-03-02', para: '2026-03-10' })
    expect(reagendarAtividade(t.atividade, '2026-03-10')).toBeNull()
    expect(ordenarAtividades([t.atividade, ter, qua]).map((a) => a.id)).toEqual(['ter', 'qua', 'seg'])
  })

  it('reagendar atrasadas é ação explícita e só afeta atividades abertas atrasadas', () => {
    const feita = concluirAtividade(seg, '2026-03-02')!.atividade
    const ts = reagendarAtrasadas([feita, ter, qua], '2026-03-04')
    expect(ts.map((t) => t.atividade.id)).toEqual(['ter'])
    expect(ts[0].atividade.reagendadaPara).toBe('2026-03-04')
  })

  it('reabrir devolve a atividade para pendente e limpa a data de realização', () => {
    const feita = concluirAtividade(seg, '2026-03-05')!.atividade
    const r = reabrirAtividade(feita)!
    expect(r.atividade.status).toBe('pendente')
    expect(r.atividade.dataRealizacao).toBeUndefined()
    expect(reabrirAtividade(seg)).toBeNull()
  })

  it('iniciar muda para em andamento; tempo realizado vem das sessões vinculadas', () => {
    expect(iniciarAtividade(seg)!.atividade.status).toBe('em_andamento')
    const ss = [sessao({ atividadeId: 'seg', duracaoSeg: 1800 }), sessao({ atividadeId: 'seg', duracaoSeg: 600 }), sessao({ atividadeId: 'ter', duracaoSeg: 999 })]
    expect(tempoRealizadoSeg('seg', ss)).toBe(2400)
  })

  it('progresso diferencia concluídas, puladas e pendentes', () => {
    const lista = [
      concluirAtividade(seg, '2026-03-02')!.atividade,
      pularAtividade(ter)!.atividade,
      qua
    ]
    const p = progressoCronograma(lista)
    expect(p).toMatchObject({ total: 3, concluidas: 1, puladas: 1, pendentes: 1 })
    expect(p.percentual).toBeCloseTo(33.33, 1)
    expect(progressoCronograma([]).percentual).toBeNull()
  })
})

describe('geração de cronograma semanal', () => {
  it('cria a sequência a partir de regras por dia da semana', () => {
    const lista = gerarAtividadesSemanais({
      concursoId: 'c1',
      dataInicio: '2026-03-02', // segunda
      semanas: 2,
      ordemInicial: 10,
      regras: [
        { diaSemana: 1, disciplinaId: 'const', duracaoMin: 90 },
        { diaSemana: 2, disciplinaId: 'port', duracaoMin: 60 },
        { diaSemana: 3, disciplinaId: 'adm', duracaoMin: 60 }
      ]
    })
    expect(lista).toHaveLength(6)
    expect(lista.map((a) => a.dataPlanejada)).toEqual(['2026-03-02', '2026-03-03', '2026-03-04', '2026-03-09', '2026-03-10', '2026-03-11'])
    expect(lista[0]).toMatchObject({ disciplinaId: 'const', duracaoMin: 90, status: 'pendente', ordem: 10 })
    expect(new Set(lista.map((a) => a.id)).size).toBe(6)
  })
})
