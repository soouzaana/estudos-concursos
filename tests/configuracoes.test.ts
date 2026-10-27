import { describe, expect, it } from 'vitest'
import { aplicarNovaMeta, configPadrao, normalizarConfiguracoes } from '@/services/configuracoes'
import { contraste, gerarTokens, hslParaRgb, modoEfetivo } from '@/services/tema'

describe('configurações', () => {
  it('valores inválidos voltam ao padrão e limites são respeitados', () => {
    const c = normalizarConfiguracoes({ modo: 'x', paleta: 'laranja', corPersonalizada: 'vermelho', tempoPadraoSessaoMin: -3, retencaoDesejada: 0.1, diasDisponiveis: [1, 9, 'a'] })
    expect(c.modo).toBe('automatico')
    expect(c.paleta).toBe('roxo')
    expect(c.corPersonalizada).toBe('#7c3aed')
    expect(c.tempoPadraoSessaoMin).toBe(1)
    expect(c.retencaoDesejada).toBe(0.7)
    expect(c.diasDisponiveis).toEqual([1])
  })
  it('lixo vira configuração padrão', () => {
    expect(normalizarConfiguracoes(null)).toEqual(configPadrao())
    expect(normalizarConfiguracoes('abc')).toEqual(configPadrao())
  })
  it('nova meta não altera as anteriores e substitui a da mesma data', () => {
    const antiga = configPadrao().metas
    const m1 = aplicarNovaMeta(antiga, { desde: '2026-03-10', metaDiariaMin: 180, metaSemanalMin: 900, metaQuestoesDia: 30 })
    expect(m1).toHaveLength(2)
    expect(m1[0]).toEqual(antiga[0])
    const m2 = aplicarNovaMeta(m1, { desde: '2026-03-10', metaDiariaMin: 60, metaSemanalMin: 300, metaQuestoesDia: 10 })
    expect(m2).toHaveLength(2)
    expect(m2[1].metaDiariaMin).toBe(60)
  })
  it('modo automático segue o sistema', () => {
    expect(modoEfetivo('automatico', true)).toBe('escuro')
    expect(modoEfetivo('automatico', false)).toBe('claro')
    expect(modoEfetivo('claro', true)).toBe('claro')
  })
  it.each(['roxo', 'rosa', 'azul', 'verde', 'lilas', 'neutro', 'personalizada'] as const)('paleta %s tem contraste AA para texto nos dois modos', (p) => {
    for (const modo of ['claro', 'escuro'] as const) {
      const t = gerarTokens(p, '#f5d90a', modo)
      const rgb = (k: string) => t[k].split(' ').map(Number) as [number, number, number]
      expect(contraste(rgb('--ink'), rgb('--surface'))).toBeGreaterThanOrEqual(4.5)
      expect(contraste(rgb('--muted'), rgb('--card'))).toBeGreaterThanOrEqual(4.5)
      expect(contraste(rgb('--accent-text'), rgb('--accent-soft'))).toBeGreaterThanOrEqual(4.5)
    }
  })
  it('conversão HSL→RGB básica', () => {
    expect(hslParaRgb(0, 100, 50)).toEqual([255, 0, 0])
  })
})
