import { describe, expect, it } from 'vitest'
import {
  continuarCronometro, criarSessaoManual, finalizarCronometro, iniciarCronometro, pausarCronometro, tempoDecorridoMs,
  validarSessaoManual
} from '@/services/cronometro'

const T0 = new Date(2026, 2, 2, 10, 0, 0).getTime()
const min = (n: number) => n * 60_000

describe('cronômetro por timestamps', () => {
  it('conta o tempo a partir dos instantes, sem depender de contador de interface', () => {
    const e = iniciarCronometro({ concursoId: 'c1', disciplinaId: 'd1' }, T0)
    expect(tempoDecorridoMs(e, T0 + min(25))).toBe(min(25))
  })

  it('pausa e continua sem contar o tempo parado', () => {
    let e = iniciarCronometro({}, T0)
    e = pausarCronometro(e, T0 + min(10))
    expect(tempoDecorridoMs(e, T0 + min(60))).toBe(min(10))
    e = continuarCronometro(e, T0 + min(60))
    expect(tempoDecorridoMs(e, T0 + min(65))).toBe(min(15))
  })

  it('o estado serializado (como no IndexedDB) recupera o tempo após recarregar/segundo plano', () => {
    const e = iniciarCronometro({ metodo: 'questoes' }, T0)
    const restaurado = JSON.parse(JSON.stringify(e))
    // app ficou 2 horas em segundo plano: nada foi perdido
    expect(tempoDecorridoMs(restaurado, T0 + 2 * 3_600_000)).toBe(2 * 3_600_000)
  })

  it('relógio que volta no tempo nunca gera duração negativa', () => {
    const e = iniciarCronometro({}, T0)
    expect(tempoDecorridoMs(e, T0 - min(5))).toBe(0)
  })

  it('finalizar gera a sessão com duração efetiva (sem pausas)', () => {
    let e = iniciarCronometro({ concursoId: 'c1', disciplinaId: 'd1', topicoId: 't1', atividadeId: 'a1', metodo: 'teoria' }, T0)
    e = pausarCronometro(e, T0 + min(30))
    e = continuarCronometro(e, T0 + min(45))
    const s = finalizarCronometro(e, T0 + min(60))!
    expect(s.duracaoSeg).toBe(45 * 60)
    expect(s.inicio).toBe(T0)
    expect(s.fim).toBe(T0 + min(60))
    expect(s).toMatchObject({ concursoId: 'c1', disciplinaId: 'd1', topicoId: 't1', atividadeId: 'a1', data: '2026-03-02', manual: false })
  })

  it('permite editar a duração ao finalizar e ignora sessões vazias', () => {
    const e = iniciarCronometro({}, T0)
    expect(finalizarCronometro(e, T0 + min(30), 20 * 60)!.duracaoSeg).toBe(1200)
    expect(finalizarCronometro(e, T0 + 200)).toBeNull()
  })

  it('registro manual valida e calcula término', () => {
    expect(validarSessaoManual({ data: '2026-03-02', inicio: '08:00', duracaoMin: 0, metodo: 'teoria' })).not.toEqual([])
    const s = criarSessaoManual({ data: '2026-03-02', inicio: '08:00', duracaoMin: 90, metodo: 'leitura', concursoId: 'c1' })
    expect(s.duracaoSeg).toBe(5400)
    expect(s.fim - s.inicio).toBe(5400_000)
    expect(s.manual).toBe(true)
    expect(s.data).toBe('2026-03-02')
  })
})
