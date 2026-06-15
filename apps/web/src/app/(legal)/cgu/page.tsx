import type { Metadata } from 'next'
import { PageTitle, Section, List } from '@/components/legal/legal-ui'

export const metadata: Metadata = { title: "Conditions générales d'utilisation · PIVOT" }

export default function CguPage() {
  return (
    <>
      <PageTitle updated="29 mai 2026">Conditions générales d&apos;utilisation</PageTitle>

      <Section title="Article 1 — Objet">
        <p>
          Les présentes conditions générales d&apos;utilisation (CGU) ont pour objet de définir les modalités de mise
          à disposition et d&apos;utilisation du service collaboratif PIVOT. Toute utilisation du service
          implique l&apos;acceptation pleine et entière des présentes CGU.
        </p>
      </Section>

      <Section title="Article 2 — Accès au service">
        <p>
          Le service est proposé à titre gratuit et non professionnel, à tout utilisateur disposant d&apos;un
          accès à Internet et d&apos;un compte. L&apos;éditeur se réserve le droit de modifier, suspendre ou
          interrompre tout ou partie du service, notamment pour des opérations de maintenance, sans que sa
          responsabilité puisse être engagée.
        </p>
      </Section>

      <Section title="Article 3 — Compte utilisateur">
        <List>
          <li>La création d&apos;un compte nécessite une adresse email valide et un mot de passe.</li>
          <li>Vous êtes responsable de la confidentialité de vos identifiants.</li>
          <li>Toute activité réalisée depuis votre compte est réputée effectuée par vous.</li>
          <li>Vous pouvez supprimer votre compte à tout moment.</li>
        </List>
      </Section>

      <Section title="Article 4 — Utilisation du service">
        <p>L&apos;utilisateur s&apos;engage à ne pas :</p>
        <List>
          <li>publier de contenus illicites, diffamatoires, haineux ou portant atteinte aux droits de tiers ;</li>
          <li>perturber le fonctionnement du service ou tenter d&apos;y accéder de manière frauduleuse ;</li>
          <li>utiliser le service à des fins contraires à la loi ou aux présentes CGU.</li>
        </List>
      </Section>

      <Section title="Article 5 — Contenus de l'utilisateur">
        <p>
          Vous restez propriétaire des contenus que vous créez sur le service. Vous accordez à l&apos;éditeur une
          licence limitée nécessaire à l&apos;hébergement et à l&apos;affichage de ces contenus dans le cadre du
          fonctionnement du service. Vous garantissez disposer des droits nécessaires sur les contenus publiés.
        </p>
      </Section>

      <Section title="Article 6 — Responsabilité">
        <p>
          Le service est fourni « en l&apos;état ». L&apos;éditeur ne garantit pas l&apos;absence d&apos;interruption
          ou d&apos;erreur et ne saurait être tenu responsable des dommages résultant de l&apos;utilisation ou de
          l&apos;impossibilité d&apos;utiliser le service, ni de la perte de données.
        </p>
      </Section>

      <Section title="Article 7 — Données personnelles">
        <p>
          Le traitement de vos données personnelles est décrit dans notre Politique de confidentialité, qui fait
          partie intégrante des présentes CGU.
        </p>
      </Section>

      <Section title="Article 8 — Modification des CGU">
        <p>
          L&apos;éditeur se réserve le droit de modifier les présentes CGU à tout moment. Les utilisateurs seront
          informés des modifications substantielles. La poursuite de l&apos;utilisation du service vaut acceptation
          des CGU mises à jour.
        </p>
      </Section>

      <Section title="Article 9 — Droit applicable">
        <p>
          Les présentes CGU sont régies par le droit français. En cas de litige, et à défaut de résolution
          amiable, le litige sera porté devant les juridictions françaises compétentes selon les règles de droit
          commun.
        </p>
      </Section>
    </>
  )
}
