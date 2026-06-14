import { test, expect } from '@playwright/test'
import { registerUser } from './helpers'

test('un daily complet : création, tour de parole, fin', async ({ page }) => {
  await registerUser(page, 'E2E Daily')
  await page.goto('/daily')

  // Création : nom + 2 participants supplémentaires
  await page.getByRole('button', { name: 'Nouveau daily' }).first().click()
  await page.getByPlaceholder('Daily du lundi, Sprint 42…').fill(`Daily E2E ${Date.now()}`)
  await page.getByRole('button', { name: '+ Ajouter une personne' }).click()
  await page.getByPlaceholder('Prénom').nth(0).fill('Alice')
  await page.getByRole('button', { name: '+ Ajouter une personne' }).click()
  await page.getByPlaceholder('Prénom').nth(1).fill('Bob')
  await page.getByRole('button', { name: 'Lancer le daily' }).click()
  await page.waitForURL(/\/daily\/.+/)

  // Tour de parole : démarrer → passer → terminer
  await page.getByRole('button', { name: /Démarrer le daily/ }).click()
  await page.getByRole('button', { name: 'Passer la parole →' }).click()
  // Sur le dernier orateur, le bouton principal devient "✓ Terminer le daily" ;
  // un lien secondaire "Terminer le daily" coexiste → on cible le bouton principal exact.
  await page.getByRole('button', { name: '✓ Terminer le daily', exact: true }).click()

  await expect(page.getByText('Daily terminé !')).toBeVisible({ timeout: 10_000 })
})
