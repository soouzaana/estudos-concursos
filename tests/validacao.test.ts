import { describe, expect, it } from 'vitest'
import { blocoConsistente, calcularAproveitamento, calcularErros, formatarPercentual, validarQuestoes } from '@/utils/validacao'

const base = { data: '2026-03-02', concursoIds: [], disciplinaId: 'd1', total: 10, acertos: 7 }

describe('validação de questões', () => {
  it('aceita um registro válido', () => {
    expect(validarQuestoes(base)).toEqual({ ok: true, erros: [] })
  })
  it('rejeita quantidades negativas', () => {
    expect(validarQuestoes({ ...base, total: -1 }).ok).toBe(false)
    expect(validarQuestoes({ ...base, acertos: -2 }).ok).toBe(false)
  })
  it('rejeita acertos acima do total', () => {
    const r = validarQuestoes({ ...base, total: 5, acertos: 6 })
    expect(r.ok).toBe(false)
    expect(r.erros.join(' ')).toMatch(/não podem ser maiores/)
  })
  it('rejeita total zero, valores fracionados e campos obrigatórios ausentes', () => {
    expect(validarQuestoes({ ...base, total: 0, acertos: 0 }).ok).toBe(false)
    expect(validarQuestoes({ ...base, total: 10.5 }).ok).toBe(false)
    expect(validarQuestoes({ ...base, disciplinaId: '' }).ok).toBe(false)
    expect(validarQuestoes({ ...base, data: '31/02/2026' }).ok).toBe(false)
    expect(validarQuestoes({ ...base, data: '2026-02-31' }).ok).toBe(false)
  })
})

describe('cálculo de erros e aproveitamento', () => {
  it('erros = total − acertos', () => {
    expect(calcularErros(10, 7)).toBe(3)
    expect(calcularErros(10, 10)).toBe(0)
  })
  it('aproveitamento = acertos ÷ total × 100', () => {
    expect(calcularAproveitamento(7, 10)).toBe(70)
    expect(calcularAproveitamento(1, 3)).toBeCloseTo(33.333, 2)
  })
  it('não divide por zero', () => {
    expect(calcularAproveitamento(0, 0)).toBeNull()
    expect(formatarPercentual(null)).toBe('—')
    expect(formatarPercentual(70)).toBe('70%')
  })
  it('verifica consistência de registros salvos', () => {
    expect(blocoConsistente({ total: 10, acertos: 3 })).toBe(true)
    expect(blocoConsistente({ total: 3, acertos: 10 })).toBe(false)
  })
})
