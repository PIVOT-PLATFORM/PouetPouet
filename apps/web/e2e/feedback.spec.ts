import { test, expect } from '@playwright/test'
import { registerUser } from './helpers'

// Board Feedback (kanban) : création d'un ticket via l'interface.
test('AC-feedback-01: un utilisateur crée un ticket qui apparaît sur le board', async ({ page }) => {
  await registerUser(page, 'E2E Feedback')
  await page.goto('/feedback')

  await page.getByRole('button', { name: 'Nouveau ticket' }).click()

  const titre = `Bug E2E ${Date.now()}`
  await page.getByPlaceholder('Résumé en une ligne').fill(titre)
  await page.getByPlaceholder('Décrivez le bug ou le besoin en détail…').fill('Étapes de reproduction du bug E2E.')
  await page.getByPlaceholder('Prénom Nom').fill('E2E Feedback')

  await page.getByRole('button', { name: 'Envoyer le ticket' }).click()

  await expect(page.getByText(titre)).toBeVisible()
})
