-- CreateTable
CREATE TABLE "locations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "description" TEXT,
    "phone" TEXT,
    "google_maps_url" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "is_internal" BOOLEAN NOT NULL DEFAULT false,
    "is_rentable" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activities" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "location_id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_offering_activities" (
    "activity_id" TEXT NOT NULL,
    "team_offering_id" TEXT NOT NULL,

    CONSTRAINT "team_offering_activities_pkey" PRIMARY KEY ("activity_id","team_offering_id")
);

-- CreateTable
CREATE TABLE "course_offering_activities" (
    "activity_id" TEXT NOT NULL,
    "course_offering_id" TEXT NOT NULL,

    CONSTRAINT "course_offering_activities_pkey" PRIMARY KEY ("activity_id","course_offering_id")
);

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_offering_activities" ADD CONSTRAINT "team_offering_activities_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_offering_activities" ADD CONSTRAINT "team_offering_activities_team_offering_id_fkey" FOREIGN KEY ("team_offering_id") REFERENCES "team_offerings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_offering_activities" ADD CONSTRAINT "course_offering_activities_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_offering_activities" ADD CONSTRAINT "course_offering_activities_course_offering_id_fkey" FOREIGN KEY ("course_offering_id") REFERENCES "course_offerings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
