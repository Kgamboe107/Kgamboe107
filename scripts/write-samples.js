/* Writes the built-in sample exports to ./samples so they can be opened or re-uploaded manually */
const fs = require('fs');
const path = require('path');
require('../js/samples.js');
const dir = path.join(__dirname, '..', 'samples');
fs.mkdirSync(dir, { recursive: true });
for (const [name, text] of Object.entries(globalThis.App.samples.build())) fs.writeFileSync(path.join(dir, name), text);
console.log('Wrote samples to', dir);
