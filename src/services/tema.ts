/**
 * Geração de tokens de tema (paleta + claro/escuro). Tudo é derivado de matiz/saturação da cor-base
 * com luminosidades fixas, o que mantém o contraste previsível em qualquer paleta (inclusive a personalizada).
 */
import type { Configuracoes, PaletaTema } from '@/types'
import { PALETAS } from './configuracoes'

export type ModoEfetivo = 'claro' | 'escuro'

export interface HSL { h: number; s: number; l: number }

export function hexParaHsl(hex: string): HSL {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  const v = m ? m[1] : '7c3aed'
  const r = parseInt(v.slice(0, 2), 16) / 255
  const g = parseInt(v.slice(2, 4), 16) / 255
  const b = parseInt(v.slice(4, 6), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  let h = 0
  let s = 0
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1))
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  return { h, s: s * 100, l: l * 100 }
}

export function hslParaRgb(h: number, s: number, l: number): [number, number, number] {
  const S = s / 100
  const L = l / 100
  const k = (n: number) => (n + h / 30) % 12
  const a = S * Math.min(L, 1 - L)
  const f = (n: number) => L - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)]
}

const rgbTxt = (rgb: [number, number, number]) => rgb.join(' ')

export function luminancia([r, g, b]: [number, number, number]): number {
  const c = [r, g, b].map((v) => {
    const x = v / 255
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}

export function contraste(a: [number, number, number], b: [number, number, number]): number {
  const la = luminancia(a)
  const lb = luminancia(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

const PASSOS: Record<number, number> = { 50: 97, 100: 94, 200: 88, 300: 78, 400: 66, 500: 55, 600: 44, 700: 36, 800: 28, 900: 21 }

export function corBase(paleta: PaletaTema, personalizada: string): string {
  if (paleta === 'personalizada') return personalizada
  return PALETAS.find((p) => p.valor === paleta)?.cor ?? '#7c3aed'
}

export function gerarTokens(paleta: PaletaTema, personalizada: string, modo: ModoEfetivo): Record<string, string> {
  const base = hexParaHsl(corBase(paleta, personalizada))
  // Cores muito claras/dessaturadas ficam utilizáveis com saturação mínima de 8% (exceto neutro).
  const sat = paleta === 'neutro' ? Math.min(base.s, 6) : Math.min(90, Math.max(base.s, 35))
  const h = base.h
  const t: Record<string, string> = {}
  // Matizes claros (verde, amarelo, ciano) ficam com pouco contraste em luminosidade fixa. Os passos 600+
  // (botões com texto branco e texto de destaque) são escurecidos até atingir contraste AA (4,5:1) com branco.
  const L = { ...PASSOS }
  let l600 = L[600]
  while (l600 > 12 && contraste(hslParaRgb(h, sat, l600), [255, 255, 255]) < 4.6) l600 -= 1
  L[600] = l600
  L[700] = Math.min(L[700], l600 - 6)
  L[800] = Math.min(L[800], L[700] - 6)
  L[900] = Math.min(L[900], L[800] - 5)
  for (const [k, l] of Object.entries(L)) t[`--b${k}`] = rgbTxt(hslParaRgb(h, sat, Math.max(l, 4)))
  const tintSat = paleta === 'neutro' ? 4 : 32
  if (modo === 'claro') {
    t['--surface'] = rgbTxt(hslParaRgb(h, tintSat, 97.5))
    t['--card'] = rgbTxt(hslParaRgb(h, 0, 100))
    t['--ink'] = rgbTxt(hslParaRgb(h, 25, 14))
    t['--muted'] = rgbTxt(hslParaRgb(h, 10, 38))
    t['--line'] = rgbTxt(hslParaRgb(h, 20, 90))
    t['--accent-text'] = t['--b700']
    t['--accent-soft'] = t['--b100']
  } else {
    t['--surface'] = rgbTxt(hslParaRgb(h, 18, 8))
    t['--card'] = rgbTxt(hslParaRgb(h, 16, 12))
    t['--ink'] = rgbTxt(hslParaRgb(h, 15, 94))
    t['--muted'] = rgbTxt(hslParaRgb(h, 10, 70))
    t['--line'] = rgbTxt(hslParaRgb(h, 12, 24))
    t['--accent-text'] = t['--b300']
    t['--accent-soft'] = rgbTxt(hslParaRgb(h, Math.min(sat, 40), 20))
  }
  return t
}

export function modoEfetivo(modo: Configuracoes['modo'], sistemaEscuro: boolean): ModoEfetivo {
  if (modo === 'automatico') return sistemaEscuro ? 'escuro' : 'claro'
  return modo
}

const CHAVE_CACHE = 'estudos-concursos:tema'

export interface TemaAplicavel {
  modo: Configuracoes['modo']
  paleta: PaletaTema
  corPersonalizada: string
}

function sistemaEscuro(): boolean {
  try {
    return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches
  } catch {
    return false
  }
}

/** Aplica o tema no documento. Também guarda em localStorage para evitar "flash" na próxima abertura. */
export function aplicarTema(c: TemaAplicavel): ModoEfetivo {
  const efetivo = modoEfetivo(c.modo, sistemaEscuro())
  const tokens = gerarTokens(c.paleta, c.corPersonalizada, efetivo)
  const raiz = document.documentElement
  for (const [k, v] of Object.entries(tokens)) raiz.style.setProperty(k, v)
  raiz.dataset.mode = efetivo === 'escuro' ? 'dark' : 'light'
  raiz.classList.toggle('dark', efetivo === 'escuro')
  raiz.style.colorScheme = efetivo === 'escuro' ? 'dark' : 'light'
  const meta = document.querySelector('meta[name="theme-color"]')
  const [r, g, b] = tokens['--b600'].split(' ').map(Number)
  const surface = tokens['--surface']
  meta?.setAttribute('content', efetivo === 'escuro' ? `rgb(${surface.split(' ').join(',')})` : `rgb(${r},${g},${b})`)
  try {
    localStorage.setItem(CHAVE_CACHE, JSON.stringify(c))
  } catch {
    /* armazenamento indisponível: ignorar */
  }
  return efetivo
}

export function aplicarTemaEmCache(): void {
  try {
    const bruto = localStorage.getItem(CHAVE_CACHE)
    if (bruto) aplicarTema(JSON.parse(bruto) as TemaAplicavel)
    else aplicarTema({ modo: 'automatico', paleta: 'roxo', corPersonalizada: '#7c3aed' })
  } catch {
    aplicarTema({ modo: 'automatico', paleta: 'roxo', corPersonalizada: '#7c3aed' })
  }
}

/** Cores categóricas para gráficos (derivadas da paleta + matizes complementares). */
export function coresGrafico(paleta: PaletaTema, personalizada: string, modo: ModoEfetivo): string[] {
  const base = hexParaHsl(corBase(paleta, personalizada))
  const l = modo === 'escuro' ? 64 : 48
  const matizes = [0, 150, 40, 200, 300, 90, 340, 240]
  return matizes.map((d) => {
    const [r, g, b] = hslParaRgb((base.h + d) % 360, paleta === 'neutro' ? 45 : 62, l)
    return `rgb(${r},${g},${b})`
  })
}
