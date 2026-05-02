const fs = require('fs');
let f = 'D:/AI Projects/Technical report/backend/app/services/pdf/builder.js';
let code = fs.readFileSync(f, 'utf8');
code = code.replace(
    "await page.setContent(html, { waitUntil: 'networkidle0' });",
    "await page.setContent(html, { waitUntil: 'networkidle0' });\n        await page.emulateMediaType('screen');\n        await page.evaluateHandle('document.fonts.ready');"
);
fs.writeFileSync(f, code);
console.log('Fixed PDF builder');
