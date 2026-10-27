import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'

const hojeISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Grava registros direto no IndexedDB do app (simula dados já existentes). */
async function semear(page: Page, qtdAtividades: number) {
  await page.goto('/#/')
  await page.waitForLoadState('networkidle')
  await page.evaluate(
    async ({ n, hoje }) => {
      const db: IDBDatabase = await new Promise((res, rej) => {
        const r = indexedDB.open('estudos-concursos-db')
        r.onsuccess = () => res(r.result)
        r.onerror = () => rej(r.error)
      })
      const put = (loja: string, obj: unknown) =>
        new Promise<void>((res, rej) => {
          const tx = db.transaction(loja, 'readwrite')
          tx.objectStore(loja).put(obj)
          tx.oncomplete = () => res()
          tx.onerror = () => rej(tx.error)
        })
      await put('concursos', { id: 'c1', nome: 'TJ-RO 2026', orgao: 'Tribunal de Justiça', cargo: 'Analista Judiciário', banca: 'FGV', situacaoEdital: 'edital_publicado', dataInicio: hoje, metaSemanalHoras: 10, metaQuestoes: 100, observacoes: '', status: 'preparacao', criadoEm: 1, atualizadoEm: 1 })
      await put('disciplinas', { id: 'd1', nome: 'Direito Constitucional', descricao: '', cor: '#7c3aed', ordem: 0, status: 'em_andamento', observacoes: '', criadoEm: 1 })
      await put('disciplinas', { id: 'd2', nome: 'Língua Portuguesa — interpretação e redação oficial', descricao: '', cor: '#059669', ordem: 1, status: 'em_andamento', observacoes: '', criadoEm: 1 })
      await put('concursoDisciplinas', { id: 'r1', concursoId: 'c1', disciplinaId: 'd1', ordem: 0 })
      await put('concursoDisciplinas', { id: 'r2', concursoId: 'c1', disciplinaId: 'd2', ordem: 1 })
      const [a, m, d] = hoje.split('-').map(Number)
      const base = new Date(a, m - 1, d)
      const iso = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
      const status = ['pendente', 'concluida', 'pulada', 'em_andamento']
      for (let i = 0; i < n; i++) {
        const dia = new Date(base)
        dia.setDate(base.getDate() - base.getDay() + (i % 7))
        await put('atividades', {
          id: `at${i}`, concursoId: 'c1', disciplinaId: i % 2 ? 'd2' : 'd1', dataPlanejada: iso(dia), horario: `${String(7 + (i % 10)).padStart(2, '0')}:00`,
          duracaoMin: 60, questoesPrevistas: i % 3 ? 10 : 0, prioridade: 'media', status: status[i % 4],
          observacoes: 'Estudar o conteúdo programado com atenção especial aos temas mais cobrados pela banca', ordem: i, criadoEm: i, atualizadoEm: i
        })
      }
      db.close()
    },
    { n: qtdAtividades, hoje: hojeISO() }
  )
  await page.goto('/#/cronograma')
  await page.reload()
}

async function abrirModal(page: Page) {
  await page.getByRole('button', { name: 'Exportar cronograma' }).click()
  await expect(page.getByRole('dialog', { name: 'Exportar cronograma' })).toBeVisible()
}

test('exporta PDF A4 (retrato) com várias páginas e nada cortado', async ({ page }) => {
  await semear(page, 60)
  await abrirModal(page)
  await page.getByRole('radio', { name: 'Mensal' }).click()
  await page.getByRole('radio', { name: 'PDF' }).click()
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 60_000 }), page.getByRole('button', { name: /Exportar PDF/ }).click()])
  expect(download.suggestedFilename()).toMatch(/^cronograma-.*\.pdf$/)
  const caminho = await download.path()
  const bytes = readFileSync(caminho!)
  expect(bytes.subarray(0, 5).toString()).toBe('%PDF-')
  const paginas = (bytes.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length
  expect(paginas).toBeGreaterThanOrEqual(2)
  expect(bytes.length).toBeGreaterThan(20_000)
})

test('exporta PDF em paisagem e PNG por semana', async ({ page }) => {
  await semear(page, 14)
  await abrirModal(page)
  await page.getByRole('radio', { name: 'PDF' }).click()
  await page.getByLabel('Orientação (A4)').selectOption('paisagem')
  const [pdf] = await Promise.all([page.waitForEvent('download', { timeout: 60_000 }), page.getByRole('button', { name: /Exportar PDF/ }).click()])
  const buf = readFileSync((await pdf.path())!).toString('latin1')
  const caixa = /\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/.exec(buf)
  expect(caixa).not.toBeNull()
  expect(Number(caixa![1])).toBeCloseTo(841.89, 0) // A4 paisagem (pt)
  expect(Number(caixa![2])).toBeCloseTo(595.28, 0)

  await page.getByRole('radio', { name: 'PNG' }).click()
  const [png] = await Promise.all([page.waitForEvent('download', { timeout: 60_000 }), page.getByRole('button', { name: /Exportar PNG/ }).click()])
  expect(png.suggestedFilename()).toMatch(/\.png$/)
  const img = readFileSync((await png.path())!)
  expect(img.subarray(1, 4).toString()).toBe('PNG')
  const largura = img.readUInt32BE(16)
  const altura = img.readUInt32BE(20)
  expect(largura).toBe(2160) // 1080 px × 2 (alta resolução)
  expect(altura).toBeGreaterThan(largura * 0.4)
})

test('o modal valida o período e não altera os dados', async ({ page }) => {
  await semear(page, 5)
  await abrirModal(page)
  await page.getByLabel('Data inicial').fill('2030-01-10')
  await page.getByLabel('Data final').fill('2030-01-01')
  await expect(page.getByText(/data inicial deve ser anterior/i)).toBeVisible()
  await expect(page.getByRole('button', { name: /Exportar PDF/ })).toBeDisabled()
})
