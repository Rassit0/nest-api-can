-- CreateTable
CREATE TABLE "institution_contacts" (
    "id" TEXT NOT NULL,
    "institution_id" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "contact_name" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "institution_contacts_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "institution_contacts" ADD CONSTRAINT "institution_contacts_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
