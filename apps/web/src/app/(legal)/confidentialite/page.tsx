import type { Metadata } from 'next'
import { PageTitle, Section, List } from '@/components/legal/legal-ui'

export const metadata: Metadata = { title: 'Politique de confidentialité · PouetPouet' }

export default function ConfidentialitePage() {
  return (
    <>
      <PageTitle updated="29 mai 2026">Politique de confidentialité</PageTitle>

      <Section title="Préambule">
        <p>
          La présente politique décrit la manière dont PouetPouet collecte, utilise et protège vos données
          personnelles, conformément au Règlement Général sur la Protection des Données (RGPD) et à la loi
          Informatique et Libertés.
        </p>
      </Section>

      <Section title="Responsable du traitement">
        <p>
          Le responsable du traitement des données est l&apos;éditeur du site, joignable à l&apos;adresse{' '}
          <a href="mailto:pouetpouetsupport@gmail.com" className="text-primary-600 hover:underline dark:text-primary-400">pouetpouetsupport@gmail.com</a>
          .
        </p>
      </Section>

      <Section title="Données collectées">
        <p>Dans le cadre de l&apos;utilisation du service, nous collectons :</p>
        <List>
          <li><strong>Données de compte</strong> : nom, adresse email, mot de passe (stocké haché, jamais en clair).</li>
          <li><strong>Données d&apos;usage</strong> : boards, dailys, salles de Scrum Poker, équipes et contenus que vous créez.</li>
          <li><strong>Données techniques</strong> : journaux de connexion, adresse IP, type de navigateur (à des fins de sécurité et de bon fonctionnement).</li>
          <li><strong>Préférences</strong> : thème d&apos;affichage, avatar.</li>
        </List>
      </Section>

      <Section title="Finalités et base légale">
        <List>
          <li>Fournir et maintenir le service (exécution du contrat).</li>
          <li>Gérer votre compte et l&apos;authentification (exécution du contrat).</li>
          <li>Assurer la sécurité et prévenir la fraude (intérêt légitime).</li>
          <li>Améliorer le service (intérêt légitime).</li>
        </List>
      </Section>

      <Section title="Durée de conservation">
        <p>
          Les données de compte sont conservées tant que votre compte est actif. En cas de suppression de votre
          compte, vos données personnelles sont effacées sous 30 jours. Les journaux techniques de connexion sont
          conservés 12 mois maximum, conformément aux obligations légales.
        </p>
      </Section>

      <Section title="Destinataires des données">
        <p>
          Vos données sont accessibles uniquement à l&apos;éditeur et à son sous-traitant technique (l&apos;hébergeur
          Google Cloud Platform). Elles ne sont ni vendues ni cédées à des tiers à des fins commerciales.
        </p>
      </Section>

      <Section title="Vos droits">
        <p>Conformément au RGPD, vous disposez des droits suivants :</p>
        <List>
          <li>Droit d&apos;accès à vos données.</li>
          <li>Droit de rectification.</li>
          <li>Droit à l&apos;effacement (« droit à l&apos;oubli »).</li>
          <li>Droit à la limitation et à l&apos;opposition au traitement.</li>
          <li>Droit à la portabilité de vos données.</li>
        </List>
        <p>
          Pour exercer ces droits, contactez{' '}
          <a href="mailto:pouetpouetsupport@gmail.com" className="text-primary-600 hover:underline dark:text-primary-400">pouetpouetsupport@gmail.com</a>
          . Vous pouvez également introduire une réclamation auprès de la CNIL (www.cnil.fr).
        </p>
      </Section>

      <Section title="Sécurité">
        <p>
          Nous mettons en œuvre des mesures techniques appropriées pour protéger vos données : mots de passe
          hachés (bcrypt), communication chiffrée (HTTPS), sessions authentifiées par jeton à durée limitée.
        </p>
      </Section>

      <Section title="Cookies et stockage local">
        <p>
          PouetPouet utilise le stockage local de votre navigateur pour conserver votre session
          d&apos;authentification et vos préférences d&apos;affichage. Ces éléments sont strictement nécessaires
          au fonctionnement du service et ne nécessitent pas de consentement. Aucun cookie de suivi publicitaire
          ni de mesure d&apos;audience tierce n&apos;est déposé.
        </p>
      </Section>
    </>
  )
}
