const fs = require('fs');

const csFile = 'test/course-seasons.e2e-spec.ts';
let csContent = fs.readFileSync(csFile, 'utf8');

csContent = csContent.replace(/billingType:\s*'RECURRING_ONLY'/g, "billingType: 'RECURRING_ONLY' as any");
csContent = csContent.replace(/recurringFee:\s*150/g, "recurringFee: '150'");

fs.writeFileSync(csFile, csContent);

const transferFile = 'test/transfer-integration.e2e-spec.ts';
let transferContent = fs.readFileSync(transferFile, 'utf8');

transferContent = transferContent.replace(/billingType:\s*'RECURRING_ONLY'/g, "billingType: 'RECURRING_ONLY' as any");
transferContent = transferContent.replace(/recurringFee:\s*100/g, "recurringFee: '100'");
transferContent = transferContent.replace(/recurringFee:\s*200/g, "recurringFee: '200'");

// Fix CycleEnrollment Creates
transferContent = transferContent.replace(/courseSeasonShiftId:\s*regularMorningShiftId,/g, "courseSeasonShift: { connect: { id: regularMorningShiftId } },");
// also need to pass courseSeasonId for CycleEnrollment because of the composite unique constraint?
// Let's just pass courseSeasonId as well.
transferContent = transferContent.replace(/courseSeasonShift:\s*\{\s*connect:\s*\{\s*id:\s*regularMorningShiftId\s*\}\s*\},/g, "courseSeasonShift: { connect: { id: regularMorningShiftId } }, courseSeason: { connect: { id: regularSeasonId } },");

fs.writeFileSync(transferFile, transferContent);
console.log('Fixed tests');
