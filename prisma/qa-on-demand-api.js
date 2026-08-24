require('dotenv').config();
const { Client } = require('pg');
const jwt = require('jsonwebtoken');

async function runQA() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  
  try {
    console.log("=== INICIANDO VALIDACIÓN QA ON-DEMAND (API) ===");
    
    const personId = 'f0000000-0000-4000-8000-000000000099';
    await client.query(`
      INSERT INTO "persons" (id, name, last_name, document_type, document_number, email, created_at, updated_at) 
      VALUES ($1, 'QA API', 'OnDemand', 'CI', 'API-' || floor(random()*1000000)::text, 'qa-api-' || floor(random()*1000000)::text || '@test.com', NOW(), NOW())
      ON CONFLICT DO NOTHING
    `, [personId]);
    
    const studentId = 'f1111111-1111-4111-8111-111111111199';
    await client.query(`
      INSERT INTO "students" (id, person_id, is_active, created_at, updated_at)
      VALUES ($1, $2, true, NOW(), NOW())
      ON CONFLICT (person_id) DO NOTHING
    `, [studentId, personId]);
    
    // Cleanup previous memberships for this student
    const prevMemberships = await client.query(`SELECT id FROM "student_memberships" WHERE student_id = $1`, [studentId]);
    for (const row of prevMemberships.rows) {
      await client.query(`DELETE FROM "student_charges" WHERE student_membership_id = $1`, [row.id]);
      await client.query(`DELETE FROM "cycle_enrollments" WHERE student_membership_id = $1`, [row.id]);
      await client.query(`DELETE FROM "student_membership_histories" WHERE student_membership_id = $1`, [row.id]);
    }
    await client.query(`DELETE FROM "student_memberships" WHERE student_id = $1`, [studentId]);
    
    console.log("✅ Estudiante base creado.");
    
    const API_URL = 'http://localhost:3001/api';
    
    const resSeason = await client.query(`SELECT id FROM "course_seasons" LIMIT 1`);
    if (resSeason.rows.length === 0) throw new Error("No hay CourseSeason en la BD");
    const courseSeasonId = resSeason.rows[0].id;
    
    const resShift = await client.query(`SELECT id FROM "course_season_shifts" WHERE course_season_id = $1 LIMIT 1`, [courseSeasonId]);
    if (resShift.rows.length === 0) throw new Error("No hay CourseSeasonShift para este CourseSeason en la BD");
    const courseSeasonShiftId = resShift.rows[0].id;
    
    const resPlan = await client.query(`SELECT id FROM "payment_plans" WHERE course_season_id = $1 LIMIT 1`, [courseSeasonId]);
    let paymentPlanId = null;
    if (resPlan.rows.length > 0) {
      paymentPlanId = resPlan.rows[0].id;
    }
    
    console.log("Inscribiendo al estudiante...");
    
    // Find admin user
    const adminRes = await client.query(`SELECT u.id, u.role_id, u.email FROM "users" u LIMIT 1`);
    if (adminRes.rows.length === 0) throw new Error("No admin user found in DB");
    
    const adminUser = adminRes.rows[0];
    
    // Create JWT token for an admin
    const token = jwt.sign({ id: adminUser.id, roleId: adminUser.role_id, email: adminUser.email }, process.env.JWT_SECRET, { expiresIn: '1h' });
    
    const enrollRes = await fetch(`${API_URL}/student-memberships`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        studentId,
        courseSeasonId,
        courseSeasonShiftId,
        paymentPlanId,
        startedAt: new Date().toISOString(),
        chargeRegistration: false,
        chargeInitialCycle: true
      })
    });
    
    const enrollData = await enrollRes.json();
    if (!enrollRes.ok) {
        console.error("Error inscribiendo:", enrollData);
        throw new Error("Failed to enroll");
    }
    const membershipId = enrollData.data.id;
    
    console.log(`✅ Inscripción inicial exitosa. Membresía: ${membershipId}`);
    
    const mRes = await client.query(`SELECT status FROM "student_memberships" WHERE id = $1`, [membershipId]);
    console.log(`  - Membresía Status: ${mRes.rows[0].status} (Esperado: ACTIVE)`);
    
    const cycleRes = await client.query(`SELECT id, status, charge_id FROM "cycle_enrollments" WHERE student_membership_id = $1`, [membershipId]);
    console.log(`  - Ciclos creados: ${cycleRes.rowCount} (Esperado: 1)`);
    console.log(`  - Ciclo Status: ${cycleRes.rows[0].status} (Esperado: PENDING)`);
    
    const chargeRes = await client.query(`SELECT status FROM "charges" WHERE id = $1`, [cycleRes.rows[0].charge_id]);
    console.log(`  - Charge Status: ${chargeRes.rows[0].status} (Esperado: PENDING)`);
    
    console.log("\n--- PRUEBA DE PAGO ---");
    const chargeId = cycleRes.rows[0].charge_id;
    const amount = cycleRes.rows[0].amount;
    
    // get cash closure
    const closureRes = await client.query(`SELECT id FROM "cash_closures" WHERE is_open = true LIMIT 1`);
    let cashClosureId = closureRes.rows.length > 0 ? closureRes.rows[0].id : null;
    
    // get cash account
    const accRes = await client.query(`SELECT id FROM "financial_accounts" WHERE is_active = true LIMIT 1`);
    const financialAccountId = accRes.rows[0].id;

    const payRes = await fetch(`${API_URL}/transactions`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        accountId: financialAccountId,
        cashClosureId,
        paymentMethod: 'CASH',
        amount: Number(amount),
        currency: 'BOB',
        reference: 'QA TEST',
        concept: 'Pago de cuota OnDemand',
        transactionDate: new Date().toISOString(),
        paymentChargeAllocations: [
          {
            chargeId: chargeId,
            allocatedAmount: Number(amount),
            notes: 'QA Allocation'
          }
        ]
      })
    });
    
    console.log(`✅ Charge pagado. Response status: ${payRes.status}`);
    
    // Check if the listener updated it
    await new Promise(r => setTimeout(r, 1000));
    
    const m2CycleRes = await client.query(`SELECT status FROM "cycle_enrollments" WHERE id = $1`, [cycleRes.rows[0].id]);
    console.log(`  - Ciclo Status post-pago: ${m2CycleRes.rows[0].status} (Esperado: CONFIRMED)`);
    
    console.log("\n=== VALIDACIÓN COMPLETADA ===");
    
  } catch(e) {
    console.error("Error en QA API:", e);
  } finally {
    await client.end();
  }
}

runQA();
