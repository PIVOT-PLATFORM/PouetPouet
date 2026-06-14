-- File d'estimation ordonnée par salle Scrum (liste de ticketIds restants).
ALTER TABLE "ScrumRoom" ADD COLUMN "queue" TEXT[] NOT NULL DEFAULT '{}';
