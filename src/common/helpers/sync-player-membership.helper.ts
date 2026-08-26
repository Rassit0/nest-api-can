import { Prisma, StatusCharge, PlayerMembershipStatus, TypeMembershipCharge } from 'src/generated/prisma/client';

export async function syncPlayerMembershipStatus(
  tx: Prisma.TransactionClient,
  chargeId: string,
  newChargeStatus: StatusCharge,
): Promise<void> {
  if (newChargeStatus !== StatusCharge.PAID) {
    return;
  }

  // Find membership charges of type REGISTRATION
  const membershipCharges = await tx.membershipCharge.findMany({
    where: { 
      chargeId,
      type: TypeMembershipCharge.REGISTRATION,
    },
    include: {
      playerMembership: {
        select: { id: true, status: true },
      },
    },
  });

  for (const mc of membershipCharges) {
    if (mc.playerMembership.status === PlayerMembershipStatus.PENDING_ACTIVE) {
      await tx.playerMembership.update({
        where: { id: mc.playerMembership.id },
        data: {
          status: PlayerMembershipStatus.ACTIVE,
          notes: 'Activada automáticamente tras pago de matrícula',
        },
      });
    }
  }
}
