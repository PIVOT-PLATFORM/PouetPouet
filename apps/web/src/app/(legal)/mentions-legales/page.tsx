import type { Metadata } from 'next'
import { PageTitle, Section, List } from '@/components/legal/legal-ui'

export const metadata: Metadata = { title: 'Mentions légales · PouetPouet' }

export default function MentionsLegalesPage() {
  return (
    <>
      <PageTitle updated="29 mai 2026">Mentions légales</PageTitle>

      <Section title="Éditeur du site">
        <p>
          Le présent site est édité à titre non professionnel par un particulier. Conformément à
          l&apos;article 6-III-2 de la loi n° 2004-575 du 21 juin 2004 pour la confiance dans
          l&apos;économie numérique (LCEN), l&apos;éditeur a choisi de ne pas communiquer publiquement son
          identité et ses coordonnées personnelles.
        </p>
        <p>
          Ces informations ont été communiquées à l&apos;hébergeur du site, qui est tenu de les conserver et
          peut les transmettre à l&apos;autorité judiciaire sur réquisition.
        </p>
        <p>
          L&apos;éditeur peut être contacté par email à l&apos;adresse{' '}
          <a href="mailto:pouetpouetsupport@gmail.com" className="text-primary-600 hover:underline dark:text-primary-400">pouetpouetsupport@gmail.com</a>
          .
        </p>
      </Section>

      <Section title="Directeur de la publication">
        <p>
          Le directeur de la publication est l&apos;éditeur du site, joignable à l&apos;adresse{' '}
          <a href="mailto:pouetpouetsupport@gmail.com" className="text-primary-600 hover:underline dark:text-primary-400">pouetpouetsupport@gmail.com</a>
          .
        </p>
      </Section>

      <Section title="Hébergement">
        <p>Le site est hébergé par :</p>
        <List>
          <li>Google Cloud Platform — Google Cloud EMEA Limited</li>
          <li>70 Sir John Rogerson&apos;s Quay, Dublin 2, Irlande</li>
          <li>Site : cloud.google.com</li>
        </List>
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
          <a href="mailto:pouetpouetsupport@gmail.com" className="text-primary-600 hover:underline dark:text-primary-400">pouetpouetsupport@gmail.com</a>
          .
        </p>
      </Section>
    </>
  )
}
