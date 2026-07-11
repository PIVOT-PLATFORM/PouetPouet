-- CreateIndex
CREATE INDEX "SignEvent_envelopeId_recipientId_type_createdAt_idx" ON "SignEvent"("envelopeId", "recipientId", "type", "createdAt");
