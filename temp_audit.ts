import { PrismaClient, StatusCharge } from './src/generated/prisma/client'; 

const prisma = new PrismaClient(); 

async function run() { 
  console.log('--- AUDITORIA DE RECARGOS (READ-ONLY) ---');

  // 1. DISTRIBUCIÓN DIARIA DE GENERACIÓN DE LATE FEES
  console.log('\n--- 1. DISTRIBUCION DIARIA DE GENERACION ---');
  const dailyDistribution = await prisma.$queryRaw`
    SELECT DATE("created_at") as date, COUNT(*) as count
    FROM "charges"
    WHERE "charge_category" = 'LATE_FEE'
    GROUP BY DATE("created_at")
    ORDER BY DATE("created_at") DESC
    LIMIT 30;
  `;
  console.log('Distribución Diaria (últimos 30 días con datos):', dailyDistribution);

  // 2. DETECCIÓN DE ANOMALÍAS
  console.log('\n--- 2. DETECCION DE ANOMALIAS ---');
  
  // Late fees sin parent
  const withoutParent = await prisma.charge.count({ where: { chargeCategory: 'LATE_FEE', parentChargeId: null } });
  console.log('- Late fees sin parentChargeId:', withoutParent);

  // Late fees cuyo parent no existe (huerfanos reales)
  const orphan = await prisma.$queryRaw`
    SELECT COUNT(*) as count FROM "charges" c
    LEFT JOIN "charges" p ON c."parentChargeId" = p.id
    WHERE c.charge_category = 'LATE_FEE' AND p.id IS NULL AND c."parentChargeId" IS NOT NULL;
  `;
  console.log('- Late fees con parent inexistente:', (orphan as any)[0]?.count?.toString());

  // Late fees cuyo parent está PAID
  const parentPaid = await prisma.charge.count({ where: { chargeCategory: 'LATE_FEE', parentCharge: { status: 'PAID' } } });
  console.log('- Late fees cuyo parentCharge está PAID:', parentPaid);

  // Late fees cuyo parent está CANCELLED
  const parentCancelled = await prisma.charge.count({ where: { chargeCategory: 'LATE_FEE', parentCharge: { status: 'CANCELLED' } } });
  console.log('- Late fees cuyo parentCharge está CANCELLED:', parentCancelled);

  // amount <= 0
  const zeroOrNegative = await prisma.charge.count({ where: { chargeCategory: 'LATE_FEE', amount: { lte: 0 } } });
  console.log('- Late fees con amount <= 0:', zeroOrNegative);

  // pendingAmount > amount
  const pendingGreaterThanAmount = await prisma.$queryRaw`
    SELECT COUNT(*) as count FROM "charges" WHERE charge_category = 'LATE_FEE' AND "pending_amount" > amount;
  `;
  console.log('- Late fees con pendingAmount > amount:', (pendingGreaterThanAmount as any)[0]?.count?.toString());

  // pendingAmount < 0
  const pendingLessThanZero = await prisma.charge.count({ where: { chargeCategory: 'LATE_FEE', pendingAmount: { lt: 0 } } });
  console.log('- Late fees con pendingAmount < 0:', pendingLessThanZero);

  // Duplicados
  const duplicated = await prisma.$queryRaw`
    SELECT "parentChargeId", COUNT(*) as cnt
    FROM "charges"
    WHERE charge_category = 'LATE_FEE'
    GROUP BY "parentChargeId"
    HAVING COUNT(*) > 1;
  `;
  console.log('- Late fees duplicados (mismo parent):', (duplicated as any).length);

  // Late fee sobre late fee
  const lateFeeOverLateFee = await prisma.charge.count({ where: { chargeCategory: 'LATE_FEE', parentCharge: { chargeCategory: 'LATE_FEE' } } });
  console.log('- Late fee sobre late fee:', lateFeeOverLateFee);

  // Late fees sin MembershipCharge (y sin StudentCharge)
  const noMembershipCharge = await prisma.charge.count({
    where: {
      chargeCategory: 'LATE_FEE',
      membershipCharges: { none: {} },
      studentCharges: { none: {} },
    }
  });
  console.log('- Late fees sin MembershipCharge ni StudentCharge:', noMembershipCharge);

  // MembershipCharge LATE_FEE sin Charge correspondiente (Integridad)
  const membershipLateFeeNoCharge = await prisma.$queryRaw`
    SELECT COUNT(*) as count FROM "membership_charges" m
    LEFT JOIN "charges" c ON m.charge_id = c.id
    WHERE m.type = 'LATE_FEE' AND c.id IS NULL;
  `;
  console.log('- MembershipCharge type LATE_FEE sin Charge en DB:', (membershipLateFeeNoCharge as any)[0]?.count?.toString());

  // Late fees asociados a TeamSeason con motor apagado
  const motorApagado = await prisma.charge.count({
    where: {
      chargeCategory: 'LATE_FEE',
      membershipCharges: {
        some: {
          playerMembership: {
            teamSeason: {
              billingConfig: {
                isEngineActive: false
              }
            }
          }
        }
      }
    }
  });
  console.log('- Late fees en TeamSeason con motor apagado:', motorApagado);

  // 3. ELEGIBLES SIN RECARGO
  console.log('\n--- 3. CARGOS ELEGIBLES SIN RECARGO ---');
  const evaluationDate = new Date();
  evaluationDate.setUTCHours(23, 59, 59, 999); // Simulación de "hoy medianoche UTC local"
  
  // Buscar cargos vencidos de membresías activas que no tienen late fee asociado
  const eligibleWithoutLateFee = await prisma.charge.findMany({
    where: {
      status: { in: ['PENDING', 'PARTIAL'] },
      parentChargeId: null,
      dueDate: { lt: evaluationDate },
      chargeCategory: { not: 'LATE_FEE' },
      membershipCharges: {
        some: {
          type: { in: ['RECURRING_FEE', 'SEASON_FEE'] },
          playerMembership: {
            status: { in: ['ACTIVE', 'SUSPENDED'] },
            teamSeason: {
              billingConfig: {
                isEngineActive: true,
                lateFeeEnabled: true
              }
            }
          }
        }
      },
      childCharges: {
        none: { chargeCategory: 'LATE_FEE' }
      }
    },
    include: {
      membershipCharges: {
        include: {
          playerMembership: {
            include: { teamSeason: { include: { billingConfig: true } } }
          }
        }
      }
    },
    take: 10
  });

  console.log(`- Total cargos elegibles encontrados (sin recargo): ${eligibleWithoutLateFee.length} (mostrando máx 10)`);
  for (const c of eligibleWithoutLateFee) {
    const config = c.membershipCharges[0]?.playerMembership?.teamSeason?.billingConfig;
    const graceDays = config?.graceDays || 0;
    const diffTime = evaluationDate.getTime() - c.dueDate.getTime();
    const elapsedDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    console.log(`  [ID: ${c.id}] - DueDate: ${c.dueDate.toISOString().split('T')[0]} - Status: ${c.status} - Días atraso: ${elapsedDays} - Grace Days: ${graceDays} -> ¿Debería tener?: ${elapsedDays > graceDays ? 'SÍ' : 'NO (en gracia)'}`);
  }

  // 4. ELEGIBILIDAD (Grupo B: Vencidos que NO cumplen alguna condición)
  console.log('\n--- 4. CARGOS VENCIDOS EXCLUIDOS DEL GENERADOR (Grupo B) ---');
  const overdueCharges = await prisma.charge.findMany({
    where: {
      dueDate: { lt: evaluationDate },
      chargeCategory: { not: 'LATE_FEE' },
      parentChargeId: null
    },
    include: {
      membershipCharges: { include: { playerMembership: { include: { teamSeason: { include: { billingConfig: true } } } } } },
      studentCharges: true,
      accountCharge: true
    },
    take: 100
  });

  const excluded = {
    paid: 0,
    cancelled: 0,
    studentCharge: 0,
    accountCharge: 0,
    motorApagado: 0,
    noLateFeeEnabled: 0,
    playerNotActive: 0
  };

  for (const c of overdueCharges) {
    if (c.status === 'PAID') { excluded.paid++; continue; }
    if (c.status === 'CANCELLED') { excluded.cancelled++; continue; }
    if (c.studentCharges.length > 0) { excluded.studentCharge++; continue; }
    if (c.accountCharge) { excluded.accountCharge++; continue; }
    
    if (c.membershipCharges.length > 0) {
      const pm = c.membershipCharges[0].playerMembership;
      if (pm.status !== 'ACTIVE' && pm.status !== 'SUSPENDED') { excluded.playerNotActive++; continue; }
      if (!pm.teamSeason.billingConfig?.isEngineActive) { excluded.motorApagado++; continue; }
      if (!pm.teamSeason.billingConfig?.lateFeeEnabled) { excluded.noLateFeeEnabled++; continue; }
    }
  }
  console.log('Motivos de exclusión de cargos vencidos:', excluded);

  // 5. RECONSTRUCCIÓN MATEMÁTICA DE CASOS
  console.log('\n--- 5. RECONSTRUCCION DE CASOS REALES ---');
  // Buscar 5 late fees aleatorios/específicos para analizar
  const sampleLateFees = await prisma.charge.findMany({
    where: { chargeCategory: 'LATE_FEE', parentCharge: { isNot: null } },
    include: {
      parentCharge: {
        include: {
          membershipCharges: {
            include: {
              playerMembership: {
                include: { 
                  teamSeason: { include: { billingConfig: true } },
                  pauses: true 
                }
              }
            }
          }
        }
      }
    },
    take: 5,
    orderBy: { createdAt: 'desc' }
  });

  for (let i = 0; i < sampleLateFees.length; i++) {
    const lf = sampleLateFees[i];
    const base = lf.parentCharge;
    if (!base) continue;
    const pm = base.membershipCharges[0]?.playerMembership;
    if (!pm) continue;
    
    const config = pm.teamSeason.billingConfig;
    const dueDate = base.dueDate;
    
    const diffTime = evaluationDate.getTime() - dueDate.getTime();
    const elapsedDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    
    // Pauses no las calcularé exacto aquí, pero las listaremos
    const pauses = pm.pauses.length;
    const graceDays = config?.graceDays || 0;
    const lateFeePerDay = Number(config?.lateFeePerDay || 0);
    
    console.log(`Caso ${i+1}: LateFeeID: ${lf.id}`);
    console.log(`  Base Status: ${base.status}, Base Amount: ${base.amount}, Base Pending: ${base.pendingAmount}`);
    console.log(`  LateFee Amount Actual: ${lf.amount}, Pending Actual: ${lf.pendingAmount}, Status: ${lf.status}`);
    console.log(`  DueDate: ${dueDate.toISOString().split('T')[0]}, Elapsed: ${elapsedDays}, Grace: ${graceDays}, Pauses: ${pauses}, Rate: ${lateFeePerDay}`);
    console.log(`  Monto Teórico Máximo (sin pausas): ${Math.max(0, elapsedDays - graceDays) * lateFeePerDay}`);
  }

  // ORIGEN DE LOS LATE FEES
  console.log('\n--- 6. ORIGEN DE LOS LATE FEES ---');
  const origins = await prisma.$queryRaw`
    SELECT "created_by_id", COUNT(*) as count
    FROM "charges"
    WHERE charge_category = 'LATE_FEE'
    GROUP BY "created_by_id";
  `;
  console.log('Creadores de Late Fees:', origins);

  const cronOrigins = await prisma.membershipCharge.groupBy({
    by: ['createdByCron'],
    where: { type: 'LATE_FEE' },
    _count: true
  });
  console.log('MembershipCharges type LATE_FEE creados por cron:', cronOrigins);
} 

run().catch(console.error).finally(() => prisma.$disconnect());
