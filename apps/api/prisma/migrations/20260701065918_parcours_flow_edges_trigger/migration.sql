-- AlterTable
ALTER TABLE "ParcourTemplate" ADD COLUMN     "flowEdges" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "triggerConfig" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "triggerType" TEXT NOT NULL DEFAULT 'manual';

-- AlterTable
ALTER TABLE "PdfDocument" ALTER COLUMN "tags" DROP DEFAULT;
