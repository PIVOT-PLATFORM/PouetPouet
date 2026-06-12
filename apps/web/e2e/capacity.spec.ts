import { test, expect } from '@playwright/test'
import { registerUser } from './helpers'

test('un événement de capacité : création, membre, capacité calculée', async ({ page }) => {
  await registerUser(page, 'E2E Capacité')
  await page.goto('/capacity')

  // Création (dates pré-remplies : aujourd'hui → +2 semaines)
  await page.getByRole('button', { name: 'Nouvel événement' }).first().click()
  await page.getByPlaceholder('PI 25.1, Sprint 42…').fill(`Sprint E2E ${Date.now()}`)
  await page.getByRole('button', { name: 'Créer l\'événement' }).click()
  await page.waitForURL(/\/capacity\/.+/)

  // Sans membre, la capacité est nulle ; on ajoute quelqu'un
  await page.getByPlaceholder('Ajouter un membre…').fill('Alice')
  await page.getByRole('button', { name: 'Ajouter', exact: true }).click()
  // Les noms de membres sont des inputs éditables, pas du texte
  await expect(page.locator('input[value="Alice"]')).toBeVisible()

  // L'indicateur "Capacité (heures)" doit refléter le membre (valeur ≠ 0)
  const capCard = page.locator('div', { has: page.getByText('Capacité (heures)', { exact: true }) }).last()
  await expect(capCard.locator('p').nth(1)).not.toHaveText('0', { timeout: 10_000 })
})
