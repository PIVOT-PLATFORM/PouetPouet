import { test, expect, request as pwRequest } from '@playwright/test'

// Remplissage d'un formulaire public (page /f/[token], sans authentification).
// Le formulaire est créé via l'API (bypass email) en amont — la page publique
// n'a pas besoin de compte.
const API = 'http://localhost:4000'
let publicToken: string

test.beforeAll(async () => {
  const api = await pwRequest.newContext({ baseURL: API })
  const email = `e2e-forms-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@test.local`
  const reg = await api.post('/api/auth/register', { data: { name: 'E2E Forms', email, password: 'e2e-Password-123!', bypass: true } })
  const token = (await reg.json()).token
  const created = await api.post('/api/forms', {
    headers: { Authorization: `Bearer ${token}` },
    data: { title: 'Formulaire E2E', fields: [{ id: 'nom', label: 'Votre nom', type: 'short_text', required: true }] },
  })
  const formId = (await created.json()).id
  const pub = await api.patch(`/api/forms/${formId}`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { isPublished: true },
  })
  publicToken = (await pub.json()).publicToken
  await api.dispose()
})

test('AC-forms-01: le répondant remplit et soumet le formulaire → écran de remerciement', async ({ page }) => {
  await page.goto(`/f/${publicToken}`)
  await expect(page.getByRole('heading', { name: 'Formulaire E2E' })).toBeVisible()

  await page.getByRole('textbox').first().fill('Jean Dupont')
  await page.getByRole('button', { name: 'Envoyer' }).click()

  await expect(page.getByRole('heading', { name: 'Merci !' })).toBeVisible()
})

test('AC-forms-02: champ requis laissé vide → message d\'erreur et pas de soumission', async ({ page }) => {
  await page.goto(`/f/${publicToken}`)
  await page.getByRole('button', { name: 'Envoyer' }).click()

  await expect(page.getByText('Ce champ est requis')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Merci !' })).toHaveCount(0)
})
