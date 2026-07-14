-- CreateTable
CREATE TABLE "player_membership_histories" (
    "id" TEXT NOT NULL,
    "player_membership_id" TEXT NOT NULL,
    "previous_status" "PlayerMembershipStatus",
    "new_status" "PlayerMembershipStatus" NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "player_membership_histories_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "player_membership_histories" ADD CONSTRAINT "player_membership_histories_player_membership_id_fkey" FOREIGN KEY ("player_membership_id") REFERENCES "player_membership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
