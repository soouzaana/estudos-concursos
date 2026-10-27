/**
 * Renderização do planner em imagem/PDF, 100% no navegador (sem APIs externas).
 * As bibliotecas pesadas são carregadas sob demanda (import dinâmico) só quando o usuário exporta.
 */
import { createApp, h, nextTick, type App } from 'vue'
import PlannerPagina from '@/components/PlannerPagina.vue'
import type { Orientacao, PaginaPlanner } from './exportacao'

/** A4 a 96 dpi, em pixels CSS. */
export const A4 = { retrato: { w: 794, h: 1123 }, paisagem: { w: 1123, h: 794 } } as const
export const LARGURA_PNG = 1080

export interface ImagemPagina {
  dataUrl: string
  largura: number
  altura: number
}

export interface ParametrosRender {
  paginas: PaginaPlanner[]
  tokens: Record<string, string>
  geradoEm: string
  /** Quando informado, as páginas têm tamanho fixo A4; senão, largura de celular e altura livre. */
  a4?: Orientacao
}

/** Monta as páginas fora da tela e devolve os elementos já renderizados. */
async function montarForaDaTela(p: ParametrosRender): Promise<{ raiz: HTMLElement; app: App; paginas: HTMLElement[] }> {
  const raiz = document.createElement('div')
  raiz.setAttribute('aria-hidden', 'true')
  raiz.style.cssText = 'position:fixed;left:-20000px;top:0;pointer-events:none;'
  document.body.appendChild(raiz)
  const tam = p.a4 ? A4[p.a4] : { w: LARGURA_PNG, h: undefined }
  const app = createApp({
    render: () =>
      h(
        'div',
        p.paginas.map((pagina) =>
          h(PlannerPagina, { key: pagina.numero, pagina, tokens: p.tokens, largura: tam.w, altura: tam.h, geradoEm: p.geradoEm })
        )
      )
  })
  app.mount(raiz)
  await nextTick()
  if (document.fonts?.ready) await document.fonts.ready
  const paginas = Array.from(raiz.querySelectorAll<HTMLElement>('.planner-pagina'))
  return { raiz, app, paginas }
}

/** Há conteúdo cortado em alguma página de tamanho fixo? (rolagem interna > altura visível) */
export function haConteudoCortado(paginas: HTMLElement[]): boolean {
  return paginas.some((el) => el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1)
}

export async function renderizarPlanner(
  p: ParametrosRender,
  aoMedir?: (cortado: boolean) => void
): Promise<{ imagens: ImagemPagina[]; cortado: boolean }> {
  const { toPng } = await import('html-to-image')
  const { raiz, app, paginas } = await montarForaDaTela(p)
  try {
    const cortado = p.a4 ? haConteudoCortado(paginas) : false
    aoMedir?.(cortado)
    if (cortado) return { imagens: [], cortado: true }
    const imagens: ImagemPagina[] = []
    for (const el of paginas) {
      const largura = el.offsetWidth
      const altura = el.offsetHeight
      const dataUrl = await toPng(el, { pixelRatio: p.a4 ? 2.5 : 2, cacheBust: false, width: largura, height: altura })
      imagens.push({ dataUrl, largura, altura })
    }
    return { imagens, cortado: false }
  } finally {
    app.unmount()
    raiz.remove()
  }
}

/** Gera o PDF (A4) com uma imagem por página. Texto fica rasterizado em alta resolução. */
export async function criarPdf(imagens: ImagemPagina[], orientacao: Orientacao, titulo: string): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: orientacao === 'retrato' ? 'portrait' : 'landscape', unit: 'mm', format: 'a4', compress: true })
  const w = doc.internal.pageSize.getWidth()
  const hh = doc.internal.pageSize.getHeight()
  imagens.forEach((img, i) => {
    if (i > 0) doc.addPage('a4', orientacao === 'retrato' ? 'portrait' : 'landscape')
    doc.addImage(img.dataUrl, 'PNG', 0, 0, w, hh, undefined, 'FAST')
  })
  doc.setProperties({ title: titulo, subject: 'Cronograma de estudos', creator: 'Estudos para Concursos' })
  return doc.output('blob')
}

export function baixarArquivo(blob: Blob | string, nome: string) {
  const url = typeof blob === 'string' ? blob : URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  document.body.appendChild(a)
  a.click()
  a.remove()
  if (typeof blob !== 'string') setTimeout(() => URL.revokeObjectURL(url), 3000)
}
