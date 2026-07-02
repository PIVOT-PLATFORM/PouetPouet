import { createCollection, createMockService } from '@pouetpouet/mock-service-kit'
import { generateOrgUnits } from './data.js'
import type { OrgUnit } from './data.js'

const PORT = Number(process.env.PORT ?? 4102)

const orgUnits = createCollection<OrgUnit>(generateOrgUnits)

const service = createMockService({ name: 'ldap-mock', port: PORT })
service.registerCollection('orgUnits', orgUnits)

const { app } = service

app.get('/org-units', async () => orgUnits.list())

app.get('/org-units/:id', async (request, reply) => {
  const { id } = request.params as { id: string }
  const unit = orgUnits.get(id)
  if (!unit) return reply.status(404).send({ error: 'Périmètre introuvable' })
  return unit
})

service.start().catch((err) => {
  console.error('[ldap-mock] échec démarrage', err)
  process.exit(1)
})
