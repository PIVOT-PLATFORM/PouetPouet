-- CreateIndex
CREATE INDEX "Contrat_numero_idx" ON "Contrat"("numero");

-- CreateIndex
CREATE INDEX "Contrat_statut_idx" ON "Contrat"("statut");

-- CreateIndex
CREATE INDEX "DemandeAchat_numero_idx" ON "DemandeAchat"("numero");

-- CreateIndex
CREATE INDEX "DemandeAchat_validationStatut_idx" ON "DemandeAchat"("validationStatut");
