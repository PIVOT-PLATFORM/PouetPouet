import { test, expect } from '@playwright/test'
import { registerUser } from './helpers'

test('un participant anonyme vote dans une salle Scrum Poker', async ({ page, browser }) => {
  // Hôte : création de salle + ticket + lancement du vote
  await registerUser(page, 'E2E Scrum Host')
  await page.goto('/scrum')
  await page.getByRole('button', { name: 'Créer une salle' }).click()
  await page.getByPlaceholder('Nom de la salle…').fill(`Salle E2E ${Date.now()}`)
  await page.getByRole('button', { name: 'Créer', exact: true }).click()
  await page.waitForURL(/\/scrum\/.+/)

  // Code de la salle (bouton "Copier le code")
  const codeButton = page.getByTitle('Copier le code')
  await expect(codeButton).toBeVisible({ timeout: 10_000 })
  const code = (await codeButton.innerText()).trim()
  expect(code).not.toBe('')

  // Ajout d'un ticket puis lancement du vote
  await page.getByPlaceholder('Ajouter un ticket…').fill('Ticket E2E')
  await page.getByTitle('Ajouter').click()
  await page.getByRole('button', { name: 'Voter →' }).click()

  // Participant anonyme : rejoint et vote
  const anonContext = await browser.newContext()
  const anonPage = await anonContext.newPage()
  await anonPage.goto(`/scrum/join/${code}`)
  await anonPage.getByPlaceholder('Marie, Thomas…').fill('Voteur E2E')
  await anonPage.getByRole('button', { name: 'Rejoindre la salle' }).click()

  await expect(anonPage.getByText('Ticket E2E')).toBeVisible({ timeout: 10_000 })
  await anonPage.getByRole('button', { name: '5', exact: true }).click()
  await expect(anonPage.getByText('Vote envoyé !')).toBeVisible({ timeout: 10_000 })

  await anonContext.close()
})
