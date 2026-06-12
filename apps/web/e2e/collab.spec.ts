import { test, expect } from '@playwright/test'
import { registerUser, createAndOpenBoard } from './helpers'

// Recette multi-utilisateur : une création de carte distante ne doit pas voler
// le focus de l'utilisateur en train d'écrire (fix/board-focus-steal).

test('le créateur édite sa carte ; une création distante ne vole pas le focus', async ({ page, browser }) => {
  await registerUser(page, 'E2E Collab A')
  await createAndOpenBoard(page, `Collab E2E ${Date.now()}`)
  const boardUrl = page.url()
  await page.waitForTimeout(500)

  // A crée une carte par double-clic → elle s'ouvre en édition chez lui
  const viewport = page.viewportSize()!
  await page.mouse.dblclick(viewport.width / 2 - 150, viewport.height / 2)
  await expect(page.locator('[data-card-id] textarea')).toBeVisible({ timeout: 5000 })
  await page.keyboard.type('Bonjour')
  const cardA = await page.locator('[data-card-id]').first().getAttribute('data-card-id')

  // B (second onglet, même compte) ouvre le board et crée une carte ailleurs.
  // L'auto-fit zoome sur l'unique carte : on dézoome avant de double-cliquer
  // pour être sûr de toucher du canvas vide.
  const ctxB = await browser.newContext({ storageState: await page.context().storageState() })
  const pageB = await ctxB.newPage()
  await pageB.goto(boardUrl)
  await expect(pageB.locator('[data-card-id]')).toHaveCount(1, { timeout: 5000 })
  await pageB.waitForTimeout(500)
  await pageB.mouse.move(viewport.width / 2, viewport.height / 2)
  await pageB.mouse.wheel(0, 600) // dézoom
  await pageB.waitForTimeout(200)
  // Attendre que le point visé soit bien du canvas vide (layout stabilisé)
  await expect
    .poll(async () => pageB.evaluate(({ x, y }) =>
      (document.elementFromPoint(x, y) as HTMLElement | null)?.className?.includes?.('overflow-hidden') ?? false,
    { x: viewport.width - 250, y: viewport.height - 250 }), { timeout: 5000 })
    .toBe(true)
  // Le join socket de B peut ne pas être encore acté côté serveur : un premier
  // dblclick trop tôt est ignoré (canWrite) — on retente une fois.
  await pageB.mouse.dblclick(viewport.width - 250, viewport.height - 250)
  try {
    await expect(pageB.locator('[data-card-id]')).toHaveCount(2, { timeout: 3000 })
  } catch {
    await pageB.mouse.dblclick(viewport.width - 250, viewport.height - 250)
  }
  await expect(pageB.locator('[data-card-id]')).toHaveCount(2, { timeout: 5000 })

  // La nouvelle carte arrive chez A… sans lui voler le focus
  await expect(page.locator('[data-card-id]')).toHaveCount(2, { timeout: 5000 })
  await page.keyboard.type(' encore')

  const focusedCardId = await page.evaluate(() =>
    document.activeElement?.closest('[data-card-id]')?.getAttribute('data-card-id') ?? null,
  )
  expect(focusedCardId).toBe(cardA)
  await expect(page.locator(`[data-card-id="${cardA}"] textarea`)).toHaveValue('Bonjour encore')

  await ctxB.close()
})

test('le reset vide le board chez tous et Ctrl+Z restaure le contenu', async ({ page }) => {
  await registerUser(page, 'E2E Reset')
  await createAndOpenBoard(page, `Reset E2E ${Date.now()}`)
  await page.waitForTimeout(500)

  // Deux cartes
  const viewport = page.viewportSize()!
  await page.mouse.dblclick(viewport.width / 2 - 200, viewport.height / 2)
  await page.keyboard.type('Carte 1')
  await page.keyboard.press('Escape')
  await page.mouse.dblclick(viewport.width / 2 + 200, viewport.height / 2)
  await page.keyboard.type('Carte 2')
  await page.keyboard.press('Escape')
  await expect(page.locator('[data-card-id]')).toHaveCount(2)

  // Reset (double clic de confirmation)
  await page.getByTitle('Réinitialiser le board').click()
  await page.getByTitle('Cliquer pour confirmer la réinitialisation').click()
  await expect(page.locator('[data-card-id]')).toHaveCount(0, { timeout: 5000 })

  // Ctrl+Z restaure les deux cartes
  await page.keyboard.press('Control+z')
  await expect(page.locator('[data-card-id]')).toHaveCount(2, { timeout: 5000 })
})
