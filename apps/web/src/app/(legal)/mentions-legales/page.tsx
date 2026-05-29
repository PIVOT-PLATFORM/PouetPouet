import type { Metadata } from 'next'
import { PageTitle, Section, Todo, List } from '@/components/legal/legal-ui'

export const metadata: Metadata = { title: 'Mentions légales · PouetPouet' }

export default function MentionsLegalesPage() {
  return (
    <>
      <PageTitle updated="29 mai 2026">Mentions légales</PageTitle>

      <Section title="Éditeur du site">
        <p>Le présent site est édité par :</p>
        <List>
          <li>Dénomination / Nom : <Todo>[À COMPLÉTER : nom ou raison sociale]</Todo></li>
          <li>Forme juridique : <Todo>[À COMPLÉTER : ex. SAS, auto-entrepreneur, particulier]</Todo></li>
          <li>Capital social : <Todo>[À COMPLÉTER si société]</Todo></li>
          <li>Adresse : <Todo>[À COMPLÉTER : adresse du siège]</Todo></li>
          <li>Email : <Todo>[À COMPLÉTER : email de contact]</Todo></li>
          <li>Téléphone : <Todo>[À COMPLÉTER]</Todo></li>
          <li>SIRET / RCS : <Todo>[À COMPLÉTER si société]</Todo></li>
          <li>N° TVA intracommunautaire : <Todo>[À COMPLÉTER si assujetti]</Todo></li>
        </List>
      </Section>

      <Section title="Directeur de la publication">
        <p>
          Le directeur de la publication est <Todo>[À COMPLÉTER : nom du responsable]</Todo>.
        </p>
      </Section>

      <Section title="Hébergement">
        <p>Le site est hébergé par :</p>
        <List>
          <li>Google Cloud Platform — Google Cloud EMEA Limited</li>
          <li>70 Sir John Rogerson&apos;s Quay, Dublin 2, Irlande</li>
          <li>Site : cloud.google.com</li>
        </List>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Adaptez cette section si vous changez d&apos;hébergeur.
        </p>
      </Section>

      <Section title="Propriété intellectuelle">
        <p>
          L&apos;ensemble des contenus présents sur ce site (textes, interface, logos, code) est, sauf mention
          contraire, la propriété de l&apos;éditeur. Toute reproduction ou représentation, totale ou partielle,
          sans autorisation préalable est interdite.
        </p>
      </Section>

      <Section title="Responsabilité">
        <p>
          L&apos;éditeur s&apos;efforce d&apos;assurer l&apos;exactitude des informations diffusées sur le site,
          mais ne saurait être tenu responsable des erreurs, d&apos;une absence de disponibilité du service ou de
          la présence de virus. L&apos;utilisateur reste seul responsable de l&apos;usage qu&apos;il fait du
          service et des contenus qu&apos;il y publie.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Pour toute question relative au site, vous pouvez écrire à{' '}
          <Todo>[À COMPLÉTER : email de contact]</Todo>.
        </p>
      </Section>
    </>
  )
}
