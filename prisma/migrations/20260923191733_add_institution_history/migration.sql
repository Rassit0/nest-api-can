-- CreateTable
CREATE TABLE "institution_history_settings" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "image_url" TEXT,
    "image_alt" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "institution_history_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "institution_history_items" (
    "id" TEXT NOT NULL,
    "year" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "institution_history_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "institution_history_items_is_active_idx" ON "institution_history_items"("is_active");

-- CreateIndex
CREATE INDEX "institution_history_items_sort_order_idx" ON "institution_history_items"("sort_order");

-- Backfill Settings Singleton
INSERT INTO "institution_history_settings" ("id", "title", "description", "updated_at")
VALUES (
    'institution-history',
    'Nuestra Historia',
    'Casi nueve décadas construyendo identidad, comunidad y excelencia deportiva. Recorré los hitos que nos definen.',
    CURRENT_TIMESTAMP
);

-- Backfill Timeline Items
INSERT INTO "institution_history_items" ("id", "year", "title", "description", "sort_order", "is_active", "updated_at") VALUES 
(gen_random_uuid()::text, '1937', 'Fundación del Club', 'Un grupo de vecinos visionarios funda la institución con la misión de promover el deporte amateur y la vida comunitaria.', 0, true, CURRENT_TIMESTAMP),
(gen_random_uuid()::text, '1958', 'Primer título metropolitano', 'El equipo de vóleibol obtiene el primer campeonato oficial, marcando el inicio de una identidad ganadora.', 1, true, CURRENT_TIMESTAMP),
(gen_random_uuid()::text, '1976', 'Apertura de la sede deportiva', 'Se inaugura el complejo principal con canchas reglamentarias y espacios para la formación de jóvenes atletas.', 2, true, CURRENT_TIMESTAMP),
(gen_random_uuid()::text, '1994', 'Nace la escuela de formación', 'La academia juvenil sistematiza el desarrollo deportivo desde edades tempranas, semillero de futuras estrellas.', 3, true, CURRENT_TIMESTAMP),
(gen_random_uuid()::text, '2011', 'Expansión multideportiva', 'El club incorpora disciplinas como frontón, atletismo y natación, consolidándose como una institución masiva.', 4, true, CURRENT_TIMESTAMP),
(gen_random_uuid()::text, '2026', 'Más de 1.000 atletas activos', 'Hoy somos una de las instituciones polideportivas más grandes de la región, con más de 50 equipos en competición.', 5, true, CURRENT_TIMESTAMP);


