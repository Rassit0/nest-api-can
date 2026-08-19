const fs = require('fs');

const csFile = 'test/course-seasons.e2e-spec.ts';
let csContent = fs.readFileSync(csFile, 'utf8');

// Fix CreateCourseSeasonDto
csContent = csContent.replace(/billingConfig:\s*\{\s*billingFrequency:\s*'MONTHLY',\s*billingType:\s*'RECURRING_ONLY'\s*as\s*any,\s*recurringFee:\s*'150'\s*\}/g, "billingConfig: { billingFrequency: 'MONTHLY', billingType: 'RECURRING_ONLY' as any, recurringFee: '150', billingDay: 1, debtToleranceMonths: 1, lateFeeEnabled: false }");

fs.writeFileSync(csFile, csContent);

const transferFile = 'test/transfer-integration.e2e-spec.ts';
let transferContent = fs.readFileSync(transferFile, 'utf8');

// Fix CreateCourseSeasonDto
transferContent = transferContent.replace(/billingConfig:\s*\{\s*billingFrequency:\s*'MONTHLY',\s*billingType:\s*'RECURRING_ONLY'\s*as\s*any,\s*recurringFee:\s*'100'\s*\}/g, "billingConfig: { billingFrequency: 'MONTHLY', billingType: 'RECURRING_ONLY' as any, recurringFee: '100', billingDay: 1, debtToleranceMonths: 1, lateFeeEnabled: false }");
transferContent = transferContent.replace(/billingConfig:\s*\{\s*billingFrequency:\s*'MONTHLY',\s*billingType:\s*'RECURRING_ONLY'\s*as\s*any,\s*recurringFee:\s*'200'\s*\}\s*\/\/\s*Más\s*caro/g, "billingConfig: { billingFrequency: 'MONTHLY', billingType: 'RECURRING_ONLY' as any, recurringFee: '200', billingDay: 1, debtToleranceMonths: 1, lateFeeEnabled: false }");

// Fix StudentMembership mixing checked and unchecked
transferContent = transferContent.replace(/courseSeasonShift:\s*\{\s*connect:\s*\{\s*id:\s*regularMorningShiftId\s*\}\s*\},/g, "courseSeasonShiftId: regularMorningShiftId,");
transferContent = transferContent.replace(/courseSeason:\s*\{\s*connect:\s*\{\s*id:\s*regularSeasonId\s*\}\s*\},/g, "courseSeasonId: regularSeasonId,");

fs.writeFileSync(transferFile, transferContent);
console.log('Fixed tests 3');
