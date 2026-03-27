/**
 * restore_service_invoice.js
 * Surgically repairs the corrupted serviceInvoiceController.js
 * 
 * The corruption: from around line 289, the content of searchServiceInvoices was 
 * injected into the middle of the INSERT VALUES template literal.
 * 
 * We will:
 * 1. Find the corrupted boundary: "finalPaymentAccount || null" followed by garbage
 * 2. Replace everything until we find  "si.ShippingCost AS shippingCost," (start of search query)
 *    which marks where the corruption ends and the rest of the file continues correctly
 * 3. Insert the correct VALUES closure lines
 */

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'controllers', 'services', 'serviceInvoiceController.js');
let content = fs.readFileSync(filePath, 'utf8');

// The correct lines that should come after "finalPaymentAccount || null,"
const correctClosure = `        \${details || null}, \${finalVNo || null}, \${insertUserId || userId || null},
        \${now}
      )
    \`;

    const idResult_serviceInvoiceId = await masterReq.query\`SELECT SCOPE_IDENTITY() AS Id\`;
    const serviceInvoiceId = idResult_serviceInvoiceId.recordset[0].Id;

    // ---------- DETAILS INSERT
    for (const item of items) {
`;

// The start of the corruption (after "finalPaymentAccount || null,")
const corruptStart = `        \${safeNumbers.paidAmount}, \${safeNumbers.due}, \${safeNumbers.change}, \${finalPaymentAccount || null},`;

// Find what comes after the corruption
// The corruption ends right before "si.ShippingCost AS shippingCost,"
const corruptEnd = `        si.ShippingCost AS shippingCost,`;

const startIdx = content.indexOf(corruptStart);
const endIdx = content.indexOf(corruptEnd);

if (startIdx === -1) {
  console.error('Could not find corruption start!');
  process.exit(1);
}
if (endIdx === -1) {
  console.error('Could not find corruption end!');
  process.exit(1);
}

console.log(`Found corruption: start at char ${startIdx}, end at char ${endIdx}`);

// Build the fixed content:
// [everything up to and including corruptStart] + correctClosure + [everything from corruptEnd onwards]
const before = content.substring(0, startIdx + corruptStart.length);
const after = content.substring(endIdx);  // starts with "si.ShippingCost..."

const fixed = before + '\n' + correctClosure + after;

fs.writeFileSync(filePath, fixed, 'utf8');
console.log('RESTORED: serviceInvoiceController.js');
console.log('New file size:', fixed.length, 'bytes');
