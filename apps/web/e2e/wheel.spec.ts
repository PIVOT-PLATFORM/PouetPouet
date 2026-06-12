import { test, expect } from '@playwright/test'
import { registerUser } from './helpers'

test('un tirage de roue depuis une équipe', async ({ page }) => {
  await registerUser(page, 'E2E Roue')

  // Une équipe est requise : création depuis /equipes
  await page.goto('/equipes')
  await page.getByRole('button', { name: 'Nouvelle équipe' }).first().click()
  await page.getByPlaceholder('Ex: Squad Alpha').fill(`Équipe Roue ${Date.now()}`)
  await page.getByPlaceholder('Membre 1').fill('Alice')
  await page.getByRole('button', { name: '+ Ajouter un membre' }).click()
  await page.getByPlaceholder('Membre 2').fill('Bob')
  await page.getByRole('button', { name: 'Créer l\'équipe' }).click()

  // Tirage : l'équipe est auto-sélectionnée sur /wheel
  await page.goto('/wheel')
  const drawButton = page.getByRole('button', { name: /Tirer 1 personne/ })
  await expect(drawButton).toBeVisible({ timeout: 10_000 })
  await drawButton.click()

  // L'animation dure ~1,5 s puis le résultat (Alice ou Bob) s'affiche
  await expect(page.getByText(/^(Alice|Bob)$/).first()).toBeVisible({ timeout: 10_000 })
})
