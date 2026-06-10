import { test, expect } from '@playwright/test'
import { registerUser, createAndOpenBoard } from './helpers'

test('créer un board et ajouter une carte par double-clic', async ({ page }) => {
  await registerUser(page, 'E2E Board')
  await createAndOpenBoard(page, `Board E2E ${Date.now()}`)

  // L'auto-fit masque le canvas ~220ms au montage ; on attend qu'il soit visible.
  await page.waitForTimeout(500)

  // Double-clic au centre du viewport (canvas vide) → création d'une carte TEXT.
  const viewport = page.viewportSize()!
  await page.mouse.dblclick(viewport.width / 2, viewport.height / 2)

  await expect(page.locator('[data-card-id]')).toHaveCount(1, { timeout: 5000 })
})
