import { test, expect } from '@playwright/test'
import { registerUser, createAndOpenBoard } from './helpers'

// Phase 1-C — cas limites multi-utilisateur : un participant qui rafraîchit sa
// page doit re-rejoindre automatiquement (sessionStorage klx_p_/klx_scrum_)
// sans repasser par le formulaire de prénom.

test('un participant scrum qui rafraîchit pendant un vote re-rejoint automatiquement', async ({ page, browser }) => {
  // Hôte : salle + ticket + lancement du vote
  await registerUser(page, 'E2E Scrum Reco Host')
  await page.goto('/scrum')
  await page.getByRole('button', { name: 'Créer une salle' }).click()
  await page.getByPlaceholder('Nom de la salle…').fill(`Salle Reco ${Date.now()}`)
  await page.getByRole('button', { name: 'Créer', exact: true }).click()
  await page.waitForURL(/\/scrum\/.+/)

  const codeButton = page.getByTitle("Copier le lien d'invitation")
  await expect(codeButton).toBeVisible({ timeout: 10_000 })
  const code = (await codeButton.innerText()).trim()

  await page.getByPlaceholder('Ajouter un ticket…').fill('Ticket Reco')
  await page.getByTitle('Ajouter').click()
  await page.getByRole('button', { name: 'Voter →' }).click()

  // Participant : rejoint puis vote
  const anonContext = await browser.newContext()
  const anonPage = await anonContext.newPage()
  await anonPage.goto(`/scrum/join/${code}`)
  await anonPage.getByPlaceholder('Marie, Thomas…').fill('Reco E2E')
  await anonPage.getByRole('button', { name: 'Rejoindre la salle' }).click()
  await expect(anonPage.getByText('Ticket Reco')).toBeVisible({ timeout: 10_000 })
  await anonPage.getByRole('button', { name: '5', exact: true }).click()
  await expect(anonPage.getByText('Vote envoyé !')).toBeVisible({ timeout: 10_000 })

  // Refresh pendant le vote : auto-rejoin sans formulaire de prénom
  await anonPage.reload()
  await expect(anonPage.getByText('Ticket Reco')).toBeVisible({ timeout: 10_000 })
  await expect(anonPage.getByPlaceholder('Marie, Thomas…')).toHaveCount(0)

  await anonContext.close()
})

test('un participant de session live qui rafraîchit re-rejoint automatiquement', async ({ page, browser }) => {
  // Hôte : board + session
  await registerUser(page, 'E2E Session Reco Host')
  await createAndOpenBoard(page, `Session Reco ${Date.now()}`)
  await page.getByRole('button', { name: 'Session' }).click()

  const codeButton = page.locator('p:has-text("Code d\'accès") + button')
  await expect(codeButton).toBeVisible({ timeout: 10_000 })
  const code = (await codeButton.innerText()).trim()

  // Participant : rejoint
  const anonContext = await browser.newContext()
  const anonPage = await anonContext.newPage()
  await anonPage.goto(`/session/${code}`)
  await anonPage.getByPlaceholder('Votre prénom').fill('Reco Live E2E')
  await anonPage.getByRole('button', { name: /Rejoindre/ }).click()
  await expect(anonPage.getByText('Vous êtes connecté !')).toBeVisible({ timeout: 10_000 })

  // Refresh : auto-rejoin sans re-saisie du prénom (fix 0.3.1)
  await anonPage.reload()
  await expect(anonPage.getByText('Vous êtes connecté !')).toBeVisible({ timeout: 10_000 })
  await expect(anonPage.getByPlaceholder('Votre prénom')).toHaveCount(0)

  await anonContext.close()
})
