import nodemailer from 'nodemailer'

// SMTP is optional: when SMTP_HOST is unset we fall back to logging the email to the
// server console, so verification still works in dev without a mail provider.
const SMTP_HOST = process.env.SMTP_HOST
const SMTP_PORT = Number(process.env.SMTP_PORT ?? 587)
const SMTP_USER = process.env.SMTP_USER
const SMTP_PASS = process.env.SMTP_PASS
const SMTP_SECURE = process.env.SMTP_SECURE === 'true'
const MAIL_FROM = process.env.MAIL_FROM ?? 'PouetPouet <no-reply@pouetpouet.app>'

export const isSmtpConfigured = Boolean(SMTP_HOST)

let transporter: nodemailer.Transporter | null = null
function getTransporter() {
  if (!isSmtpConfigured) return null
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
    })
  }
  return transporter
}

function verificationHtml(name: string, link: string) {
  return `<!doctype html>
<html lang="fr">
  <body style="margin:0;background:#f9fafb;font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;color:#111827;">
    <div style="max-width:480px;margin:0 auto;padding:40px 24px;">
      <div style="text-align:center;margin-bottom:28px;">
        <span style="display:inline-block;font-size:28px;font-weight:800;color:#4f46e5;letter-spacing:-0.02em;">🎯 PouetPouet</span>
      </div>
      <div style="background:#ffffff;border:1px solid #f3f4f6;border-radius:16px;padding:32px;">
        <h1 style="margin:0 0 12px;font-size:20px;font-weight:700;">Bonjour ${name},</h1>
        <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#4b5563;">
          Bienvenue sur PouetPouet ! Confirmez votre adresse email pour activer votre compte.
        </p>
        <div style="text-align:center;margin:28px 0;">
          <a href="${link}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 28px;border-radius:12px;">
            Vérifier mon adresse email
          </a>
        </div>
        <p style="margin:0 0 8px;font-size:12px;line-height:1.6;color:#9ca3af;">
          Ou copiez ce lien dans votre navigateur :
        </p>
        <p style="margin:0;font-size:12px;line-height:1.6;word-break:break-all;">
          <a href="${link}" style="color:#4f46e5;">${link}</a>
        </p>
        <p style="margin:20px 0 0;font-size:12px;color:#9ca3af;">Ce lien expire dans 24 heures.</p>
      </div>
      <p style="text-align:center;margin:24px 0 0;font-size:11px;color:#cbd5e1;">
        Si vous n'êtes pas à l'origine de cette inscription, ignorez simplement cet email.
      </p>
    </div>
  </body>
</html>`
}

function passwordResetHtml(name: string, link: string) {
  return `<!doctype html>
<html lang="fr">
  <body style="margin:0;background:#f9fafb;font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;color:#111827;">
    <div style="max-width:480px;margin:0 auto;padding:40px 24px;">
      <div style="text-align:center;margin-bottom:28px;">
        <span style="display:inline-block;font-size:28px;font-weight:800;color:#4f46e5;letter-spacing:-0.02em;">🎯 PouetPouet</span>
      </div>
      <div style="background:#ffffff;border:1px solid #f3f4f6;border-radius:16px;padding:32px;">
        <h1 style="margin:0 0 12px;font-size:20px;font-weight:700;">Bonjour ${name},</h1>
        <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#4b5563;">
          Vous avez demandé la réinitialisation de votre mot de passe. Cliquez sur le bouton ci-dessous pour en choisir un nouveau.
        </p>
        <div style="text-align:center;margin:28px 0;">
          <a href="${link}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 28px;border-radius:12px;">
            Réinitialiser mon mot de passe
          </a>
        </div>
        <p style="margin:0 0 8px;font-size:12px;line-height:1.6;color:#9ca3af;">
          Ou copiez ce lien dans votre navigateur :
        </p>
        <p style="margin:0;font-size:12px;line-height:1.6;word-break:break-all;">
          <a href="${link}" style="color:#4f46e5;">${link}</a>
        </p>
        <p style="margin:20px 0 0;font-size:12px;color:#9ca3af;">Ce lien expire dans 1 heure. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
      </div>
    </div>
  </body>
</html>`
}

export async function sendPasswordResetEmail(to: string, name: string, link: string): Promise<boolean> {
  const tx = getTransporter()
  if (!tx) {
    console.log(`\n📧 [mailer] SMTP non configuré — lien de réinitialisation pour ${to} :\n   ${link}\n`)
    return false
  }
  await tx.sendMail({
    from: MAIL_FROM,
    to,
    subject: 'Réinitialisez votre mot de passe — PouetPouet',
    html: passwordResetHtml(name, link),
  })
  return true
}

// Gabarit générique « action sur un document » réutilisé par SignDoc.
function actionHtml(title: string, name: string, intro: string, cta: string, link: string, footnote: string) {
  return `<!doctype html>
<html lang="fr">
  <body style="margin:0;background:#f9fafb;font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;color:#111827;">
    <div style="max-width:480px;margin:0 auto;padding:40px 24px;">
      <div style="text-align:center;margin-bottom:28px;">
        <span style="display:inline-block;font-size:28px;font-weight:800;color:#0d9488;letter-spacing:-0.02em;">✍️ SignDoc</span>
      </div>
      <div style="background:#ffffff;border:1px solid #f3f4f6;border-radius:16px;padding:32px;">
        <h1 style="margin:0 0 12px;font-size:20px;font-weight:700;">${title}</h1>
        <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#4b5563;">Bonjour ${name},<br/>${intro}</p>
        <div style="text-align:center;margin:28px 0;">
          <a href="${link}" style="display:inline-block;background:#0d9488;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 28px;border-radius:12px;">${cta}</a>
        </div>
        <p style="margin:0 0 8px;font-size:12px;line-height:1.6;color:#9ca3af;">Ou copiez ce lien dans votre navigateur :</p>
        <p style="margin:0;font-size:12px;line-height:1.6;word-break:break-all;"><a href="${link}" style="color:#0d9488;">${link}</a></p>
        <p style="margin:20px 0 0;font-size:12px;color:#9ca3af;">${footnote}</p>
      </div>
    </div>
  </body>
</html>`
}

// Envoi de la demande de signature à un signataire (lien tokenisé). Best-effort :
// log console si SMTP non configuré (comme le reste du mailer).
export async function sendSignatureRequestEmail(to: string, name: string, envelopeName: string, link: string, deadline?: string | null): Promise<boolean> {
  const tx = getTransporter()
  if (!tx) {
    console.log(`\n📧 [mailer] SMTP non configuré — lien de signature pour ${to} :\n   ${link}\n`)
    return false
  }
  const dl = deadline ? `À signer avant le ${new Date(deadline).toLocaleDateString('fr-FR')}.` : 'Merci de le signer dès que possible.'
  await tx.sendMail({
    from: MAIL_FROM,
    to,
    subject: `Document à signer : ${envelopeName}`,
    html: actionHtml('Un document vous attend', name, `Vous êtes invité·e à signer « ${envelopeName} ». ${dl}`, 'Consulter et signer', link, "Si vous n'êtes pas concerné·e, ignorez cet email."),
  })
  return true
}

// Informe un destinataire en copie (CC) qu'un parcours de signature démarre (lien de consultation).
export async function sendSignatureCopyEmail(to: string, name: string, envelopeName: string, link: string): Promise<boolean> {
  const tx = getTransporter()
  if (!tx) {
    console.log(`\n📧 [mailer] SMTP non configuré — copie « ${envelopeName} » pour ${to} :\n   ${link}\n`)
    return false
  }
  await tx.sendMail({
    from: MAIL_FROM,
    to,
    subject: `Document en copie : ${envelopeName}`,
    html: actionHtml('Document partagé en copie', name, `Vous recevez « ${envelopeName} » en copie pour information : un parcours de signature est en cours. Aucune action n'est attendue de votre part.`, 'Consulter le document', link, 'Vous recevrez le document finalisé une fois toutes les signatures recueillies.'),
  })
  return true
}

// Notifie un destinataire que l'enveloppe est entièrement signée (lien d'accès owner).
export async function sendSignatureCompletedEmail(to: string, name: string, envelopeName: string, link: string): Promise<boolean> {
  const tx = getTransporter()
  if (!tx) {
    console.log(`\n📧 [mailer] SMTP non configuré — « ${envelopeName} » signé, lien pour ${to} :\n   ${link}\n`)
    return false
  }
  await tx.sendMail({
    from: MAIL_FROM,
    to,
    subject: `Document signé : ${envelopeName}`,
    html: actionHtml('Document entièrement signé', name, `Tous les signataires ont signé « ${envelopeName} ».`, 'Voir le document', link, 'Vous recevez cet email en tant que partie prenante de ce document.'),
  })
  return true
}

/**
 * Sends the account-verification email. Returns true when actually dispatched via SMTP,
 * false when it was only logged to the console (no SMTP configured).
 */
export async function sendVerificationEmail(to: string, name: string, link: string): Promise<boolean> {
  const tx = getTransporter()
  if (!tx) {
    console.log(`\n📧 [mailer] SMTP non configuré — lien de vérification pour ${to} :\n   ${link}\n`)
    return false
  }
  await tx.sendMail({
    from: MAIL_FROM,
    to,
    subject: 'Vérifiez votre adresse email — PouetPouet',
    html: verificationHtml(name, link),
  })
  return true
}

function formResponseHtml(formTitle: string, link: string) {
  return `<!doctype html>
<html lang="fr">
  <body style="margin:0;background:#f9fafb;font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;color:#111827;">
    <div style="max-width:480px;margin:0 auto;padding:40px 24px;">
      <div style="background:#ffffff;border:1px solid #f3f4f6;border-radius:16px;padding:32px;">
        <h1 style="margin:0 0 12px;font-size:20px;font-weight:700;">Nouvelle réponse</h1>
        <p style="margin:0 0 8px;font-size:14px;line-height:1.6;color:#4b5563;">
          Votre formulaire <strong>${formTitle}</strong> a reçu une nouvelle réponse.
        </p>
        <div style="text-align:center;margin:28px 0;">
          <a href="${link}" style="display:inline-block;background:#7c3aed;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 28px;border-radius:12px;">
            Voir les réponses
          </a>
        </div>
      </div>
    </div>
  </body>
</html>`
}
export async function sendFormResponseEmail(to: string, formTitle: string, link: string): Promise<boolean> {
  const tx = getTransporter()
  if (!tx) {
    console.log(`\n📧 [mailer] Nouvelle réponse formulaire pour ${to} : ${formTitle}\n   ${link}\n`)
    return false
  }
  await tx.sendMail({
    from: MAIL_FROM,
    to,
    subject: `Nouvelle réponse : "${formTitle}"`,
    html: formResponseHtml(formTitle, link),
  })
  return true
}
