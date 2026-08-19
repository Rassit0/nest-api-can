const fs = require('fs');

const csFile = 'test/course-seasons.e2e-spec.ts';
let csContent = fs.readFileSync(csFile, 'utf8');

// Add registrationFee
csContent = csContent.replace(/billingDay:\s*1,\s*debtToleranceMonths:\s*1,\s*lateFeeEnabled:\s*false/g, "billingDay: 1, debtToleranceMonths: 1, lateFeeEnabled: false, registrationFee: '10'");

fs.writeFileSync(csFile, csContent);

const transferFile = 'test/transfer-integration.e2e-spec.ts';
let transferContent = fs.readFileSync(transferFile, 'utf8');

// Add registrationFee
transferContent = transferContent.replace(/billingDay:\s*1,\s*debtToleranceMonths:\s*1,\s*lateFeeEnabled:\s*false/g, "billingDay: 1, debtToleranceMonths: 1, lateFeeEnabled: false, registrationFee: '10'");

// Fix the duplicate courseSeasonId
transferContent = transferContent.replace(/courseSeasonShiftId:\s*regularMorningShiftId,\s*courseSeasonId:\s*regularSeasonId,/g, "courseSeasonShiftId: regularMorningShiftId,");

fs.writeFileSync(transferFile, transferContent);
console.log('Fixed tests 4');
