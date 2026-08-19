const fs = require('fs');

const csFile = 'test/course-seasons.e2e-spec.ts';
let csContent = fs.readFileSync(csFile, 'utf8');

csContent = csContent.replace(
  /afternoonShiftId\s*=\s*res\.data\.id;/g,
  "afternoonShiftId = res.data.shifts.find(s => s.shiftId === shiftAfternoonId).id;"
);

// We need morningShiftId. Where is morningShiftId defined?
// In test A: `morningShiftId = result.data.shifts[0].id;` wait, let's just make it robust.
csContent = csContent.replace(
  /expect\(dbSeason\.shifts\[0\]\.id\)\.toBe\(morningShiftId\);\s*expect\(dbSeason\.shifts\[1\]\.id\)\.toBe\(afternoonShiftId\);/g,
  "expect(dbSeason.shifts.find(s => s.id === morningShiftId)).toBeDefined(); expect(dbSeason.shifts.find(s => s.id === afternoonShiftId)).toBeDefined();"
);

fs.writeFileSync(csFile, csContent);

const transferFile = 'test/transfer-integration.e2e-spec.ts';
let transferContent = fs.readFileSync(transferFile, 'utf8');

// Fix StudentMembership and CycleEnrollment missing courseSeasonId
transferContent = transferContent.replace(
  /courseSeasonShiftId:\s*regularMorningShiftId,/g,
  "courseSeasonShiftId: regularMorningShiftId, courseSeasonId: regularSeasonId,"
);

// However, we did a replace before that removed it, or I broke it. 
// Let's replace exactly what causes the error:
// test/transfer-integration.e2e-spec.ts:208:9 - error TS2322
transferContent = transferContent.replace(
  /studentMembershipId:\s*membershipId,\s*courseSeasonShiftId:\s*regularMorningShiftId,\s*chargeId:\s*chargeId,/g,
  "studentMembershipId: membershipId, courseSeasonShiftId: regularMorningShiftId, courseSeasonId: regularSeasonId, chargeId: chargeId,"
);
transferContent = transferContent.replace(
  /studentMembershipId:\s*membershipId,\s*courseSeasonShiftId:\s*premiumMorningShiftId,\s*chargeId:\s*newChargeId,/g,
  "studentMembershipId: membershipId, courseSeasonShiftId: premiumMorningShiftId, courseSeasonId: premiumSeasonId, chargeId: newChargeId,"
);

fs.writeFileSync(transferFile, transferContent);
console.log('Fixed tests 8');
