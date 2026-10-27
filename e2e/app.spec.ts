import { expect, test } from '@playwright/test'

const ROTAS = ['/', '/concursos', '/disciplinas', '/cronograma', '/estudos', '/questoes', '/erros', '/flashcards', '/desempenho', '/calendario', '/configuracoes']

test('todas as telas abrem sem erros no console', async ({ page }) => {
  const problemas: string[] = []
  page.on('pageerror', (e) => problemas.push(e.message))
  page.on('console', (m) => m.type() === 'error' && problemas.push(m.text()))
  for (const r of ROTAS) {
    await page.goto(`/#${r}`)
    await expect(page.locator('main, #app').first()).toBeVisible()
    await page.waitForLoadState('networkidle')
  }
  expect(problemas).toEqual([])
})

test('criar concurso, recarregar e manter os dados; tema persiste', async ({ page }) => {
  await page.goto('/#/concursos')
  await page.getByRole('button', { name: 'Novo concurso' }).first().click()
  await page.locator('#co-nome').fill('TJ-RO 2026')
  await page.locator('#co-orgao').fill('Tribunal de Justiça')
  await page.getByRole('button', { name: 'Salvar concurso' }).click()
  await expect(page.getByText('TJ-RO 2026').first()).toBeVisible()
  await page.reload()
  await expect(page.getByText('TJ-RO 2026').first()).toBeVisible()

  await page.goto('/#/configuracoes')
  await page.getByRole('radio', { name: 'Escuro' }).click()
  await page.getByRole('radio', { name: 'Verde' }).click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await page.reload()
  await expect(page.locator('html')).toHaveClass(/dark/)
})

test('exporta backup e rejeita arquivo inválido sem alterar dados', async ({ page }) => {
  await page.goto('/#/concursos')
  await page.getByRole('button', { name: 'Novo concurso' }).first().click()
  await page.locator('#co-nome').fill('Concurso Backup')
  await page.getByRole('button', { name: 'Salvar concurso' }).click()
  await page.goto('/#/configuracoes')
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Exportar backup/ }).click()])
  expect(download.suggestedFilename()).toMatch(/^backup-estudos-concursos-\d{8}-\d{4}\.json$/)

  await page.locator('input[type=file]').setInputFiles({ name: 'ruim.json', mimeType: 'application/json', buffer: Buffer.from('{nao e json') })
  await expect(page.getByText('Não foi possível importar este arquivo')).toBeVisible()
  await page.goto('/#/concursos')
  await expect(page.getByText('Concurso Backup').first()).toBeVisible()
})

test('layout responsivo: navegação inferior no celular e lateral no desktop', async ({ page }, info) => {
  await page.goto('/')
  const principal = page.getByRole('navigation', { name: 'Principal' })
  await expect(principal.first()).toBeAttached()
  const visiveis = await principal.evaluateAll((els) => els.filter((e) => (e as HTMLElement).checkVisibility()).length)
  expect(visiveis).toBe(1)
  const rolagemHorizontal = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(rolagemHorizontal, `${info.project.name} sem rolagem horizontal`).toBe(false)
})
