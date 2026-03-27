/**
 * fix_scope_identity.js
 * 
 * Fixes the pattern where:
 *   const RESULT = await REQUEST.query`INSERT...VALUES(...)`; 
 *   const ID = RESULT.recordset[0].Id;
 *
 * Is split into:
 *   await REQUEST.query`INSERT...VALUES(...)`;
 *   const idResult = await REQUEST.query`SELECT SCOPE_IDENTITY() AS Id`;
 *   const ID = idResult.recordset[0].Id;
 */

const fs = require('fs');
const path = require('path');

function getAllJsFiles(dir) {
  const results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results.push(...getAllJsFiles(fullPath));
    } else if (file.endsWith('.js') && !file.endsWith('.backup.js')) {
      results.push(fullPath);
    }
  });
  return results;
}

const controllersDir = path.join(__dirname, 'controllers');
const files = getAllJsFiles(controllersDir);
let totalFixed = 0;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  // Pattern: const RESVAR = await REQVAR.query`...` 
  // followed by: const IDVAR = RESVAR.recordset[0].Id;
  // We need to:
  //   1. Remove "const RESVAR = " prefix from the await call
  //   2. Insert "const idResult_IDVAR = await REQVAR.query`SELECT SCOPE_IDENTITY() AS Id`;"
  //   3. Change "const IDVAR = RESVAR.recordset[0].Id;" -> "const IDVAR = idResult_IDVAR.recordset[0].Id;"

  // Match: const RESVAR = await REQVAR.query` ... `;\n\n    const IDVAR = RESVAR.recordset[0].Id;
  const pattern = /const (\w+) = (await (\w+)\.query`[^`]+`);\s*\n(\s*)const (\w+) = \1\.recordset\[0\]\.Id;/g;

  content = content.replace(pattern, (match, resVar, awaitExpr, reqVar, indent, idVar) => {
    changed = true;
    return `${awaitExpr};\n${indent}const idResult_${idVar} = await ${reqVar}.query\`SELECT SCOPE_IDENTITY() AS Id\`;\n${indent}const ${idVar} = idResult_${idVar}.recordset[0].Id;`;
  });

  if (changed) {
    fs.writeFileSync(file, content, 'utf8');
    console.log('FIXED:', path.basename(file));
    totalFixed++;
  }
});

console.log(`\nDone. Fixed ${totalFixed} files.`);
