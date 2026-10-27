import { describe, expect, it } from 'vitest'
import { ALGORITMO, ehNovo, estaVencido, previaIntervalos, revisarCartao, venceHoje } from '@/services/fsrs'
import { cartao } from './fabricas'

const T0 = new Date(2026, 2, 2, 9, 0, 0).getTime()
const DIA = 86_400_000

describe('repetição espaçada (FSRS)', () => {
  it('usa de fato a biblioteca FSRS', () => {
    expect(ALGORITMO).toContain('FSRS')
  })

  it('cartão novo está disponível e é identificado como novo', () => {
    const c = cartao({ proximaRevisao: T0 })
    expect(ehNovo(c)).toBe(true)
    expect(estaVencido(c, T0 + 1000)).toBe(true)
  })

  it('"bom" agenda a próxima revisão no futuro e grava o histórico', () => {
    const c = cartao({ proximaRevisao: T0 })
    const { cartao: novo, revisao } = revisarCartao(c, 'bom', T0)
    expect(novo.proximaRevisao).toBeGreaterThan(T0)
    expect(novo.fsrs.reps).toBe(1)
    expect(novo.fsrs.lastReview).toBe(T0)
    expect(revisao).toMatchObject({ cartaoId: c.id, nota: 'bom', data: '2026-03-02', em: T0 })
    expect(ehNovo(novo)).toBe(false)
  })

  it('notas melhores produzem intervalos iguais ou maiores (errei ≤ difícil ≤ bom ≤ fácil)', () => {
    const c = cartao({ proximaRevisao: T0 })
    const due = (n: 'errei' | 'dificil' | 'bom' | 'facil') => revisarCartao(c, n, T0).cartao.proximaRevisao
    expect(due('errei')).toBeLessThanOrEqual(due('dificil'))
    expect(due('dificil')).toBeLessThanOrEqual(due('bom'))
    expect(due('bom')).toBeLessThan(due('facil'))
  })

  it('errar um cartão já aprendido conta como lapso e traz a revisão para perto', () => {
    let c = cartao({ proximaRevisao: T0 })
    let agora = T0
    for (let i = 0; i < 4; i++) {
      c = revisarCartao(c, 'bom', agora).cartao
      agora = c.proximaRevisao + 1000
    }
    const longe = c.proximaRevisao - agora
    const { cartao: errado } = revisarCartao(c, 'errei', agora)
    expect(errado.fsrs.lapses).toBeGreaterThanOrEqual(1)
    expect(errado.proximaRevisao - agora).toBeLessThan(DIA)
    expect(longe).toBeLessThan(0) // sanity: já estava vencido quando revisado
  })

  it('o intervalo cresce a cada acerto consecutivo', () => {
    let c = cartao({ proximaRevisao: T0 })
    let agora = T0
    const intervalos: number[] = []
    for (let i = 0; i < 6; i++) {
      const r = revisarCartao(c, 'bom', agora)
      intervalos.push(r.cartao.proximaRevisao - agora)
      c = r.cartao
      agora = c.proximaRevisao
    }
    expect(intervalos[5]).toBeGreaterThan(intervalos[2])
    expect(intervalos[5]).toBeGreaterThan(DIA)
  })

  it('maior retenção desejada gera intervalos menores', () => {
    const base = cartao({ proximaRevisao: T0 })
    let a = revisarCartao(base, 'bom', T0, 0.8).cartao
    let b = revisarCartao(base, 'bom', T0, 0.97).cartao
    for (let i = 0; i < 3; i++) {
      a = revisarCartao(a, 'bom', a.proximaRevisao, 0.8).cartao
      b = revisarCartao(b, 'bom', b.proximaRevisao, 0.97).cartao
    }
    expect(a.proximaRevisao - a.fsrs.lastReview!).toBeGreaterThan(b.proximaRevisao - b.fsrs.lastReview!)
  })

  it('prévia dos intervalos tem um rótulo por nota', () => {
    const p = previaIntervalos(cartao({ proximaRevisao: T0 }), T0)
    expect(Object.keys(p).sort()).toEqual(['bom', 'dificil', 'errei', 'facil'])
    expect(Object.values(p).every((v) => typeof v === 'string' && v.length > 0)).toBe(true)
  })

  it('"vence hoje" inclui o restante do dia e exclui amanhã; arquivados nunca vencem', () => {
    const hoje = cartao({ proximaRevisao: T0 + 3 * 3_600_000 })
    const amanha = cartao({ proximaRevisao: T0 + DIA + 3_600_000 })
    expect(venceHoje(hoje, T0)).toBe(true)
    expect(venceHoje(amanha, T0)).toBe(false)
    expect(venceHoje(cartao({ proximaRevisao: 0, arquivado: true }), T0)).toBe(false)
  })
})
