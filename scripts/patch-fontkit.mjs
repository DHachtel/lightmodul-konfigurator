/**
 * postinstall: fontkit v2.0.x liefert kein dist/module.mjs aus,
 * aber @react-pdf/font importiert diesen Pfad via package.json exports.
 * Dieses Script erstellt einen ESM-Wrapper der main.cjs re-exportiert.
 */
import { writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const target = join(__dirname, '..', 'node_modules', 'fontkit', 'dist', 'module.mjs');

if (!existsSync(target)) {
  const shim = `import { createRequire } from "module";
const require = createRequire(import.meta.url);
const fontkit = require("./main.cjs");
export default fontkit;
export const create = fontkit.create;
export const open = fontkit.open;
`;
  writeFileSync(target, shim, 'utf8');
  console.log('[patch-fontkit] Created fontkit/dist/module.mjs ESM wrapper');
} else {
  console.log('[patch-fontkit] fontkit/dist/module.mjs already exists, skipping');
}
