const fs = require('fs');

const csFile = 'test/course-seasons.e2e-spec.ts';
let csContent = fs.readFileSync(csFile, 'utf8');

csContent = csContent.replace(/billingType:\s*'RECURRING_ONLY'/g, "billingType: 'MONTHLY_ONLY'");

fs.writeFileSync(csFile, csContent);

const transferFile = 'test/transfer-integration.e2e-spec.ts';
let transferContent = fs.readFileSync(transferFile, 'utf8');

transferContent = transferContent.replace(/billingType:\s*'RECURRING_ONLY'/g, "billingType: 'MONTHLY_ONLY'");

fs.writeFileSync(transferFile, transferContent);
console.log('Fixed tests 7');
