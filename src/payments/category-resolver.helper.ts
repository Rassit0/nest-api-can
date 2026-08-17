import { AccountCategory } from 'src/generated/prisma/client';

export type AccountCategoryWithParent = AccountCategory & {
  parent?: AccountCategory | null;
};

/**
 * Interface that matches the Payload returned by Prisma queries with the required includes.
 * It does NOT need to be exactly the Prisma generated types, but duck-typing is sufficient
 * as long as the shapes match.
 */
export interface ChargeForCategoryResolution {
  studentCharges?: Array<{
    type?: string;
    studentMembership?: {
      courseSeason?: {
        course?: {
          school?: {
            defaultAccountCategory?: AccountCategoryWithParent | null;
          };
        };
      };
    };
  }>;
  membershipCharges?: Array<{
    type?: string;
    playerMembership?: {
      teamSeason?: {
        team?: {
          club?: {
            defaultAccountCategory?: AccountCategoryWithParent | null;
          };
        };
      };
    };
  }>;
  accountCharge?: {
    category?: AccountCategoryWithParent | null;
  } | null;
}

/**
 * Resolves the effective category from a fully populated Charge payload in-memory.
 * It applies the exact precedence logic (AccountCharge > Student > Membership)
 * but NEVER throws exceptions due to `isActive` status (for reporting),
 * EXCEPT if explicitly requested (e.g. during emission).
 *
 * @param charge The charge payload with relations populated.
 * @param sysRecCategory (Ignorado en la nueva arquitectura)
 * @returns The resolved AccountCategory (including parent) or null.
 */
export function resolveEffectiveCategoryFromPayload(
  charge: ChargeForCategoryResolution | null | undefined,
  sysRecCategory?: AccountCategoryWithParent | null
): AccountCategoryWithParent | null {
  if (!charge) return null;

  // 1. AccountCharge explícito (tiene su propia categoría)
  if (charge.accountCharge && charge.accountCharge.category) {
    return charge.accountCharge.category;
  }
  
  // 2. StudentCharge (Escuelas) -> Siempre usa la categoría por defecto de la Escuela (ESC)
  if (charge.studentCharges && charge.studentCharges.length > 0) {
    const sc = charge.studentCharges[0];
    const category = sc.studentMembership?.courseSeason?.course?.school?.defaultAccountCategory;
    if (category) return category;
  }

  // 3. MembershipCharge (Equipos) -> Siempre usa la categoría por defecto del Club (EQP)
  if (charge.membershipCharges && charge.membershipCharges.length > 0) {
    const mc = charge.membershipCharges[0];
    const category = mc.playerMembership?.teamSeason?.team?.club?.defaultAccountCategory;
    if (category) return category;
  }

  // Fallback
  return null;
}
