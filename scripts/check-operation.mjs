import { spawn } from 'node:child_process';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const tests = (await readdir(new URL('./', import.meta.url))).filter(name => name.endsWith('.test.mjs')).sort().map(name => `scripts/${name}`);
const checks = [
  ['Pruebas de módulos y operación', ['--test', ...tests]],
  ['Estructura', ['scripts/check-structure.mjs']],
  ['Compilaciones API/demo', ['scripts/check-build-modes.mjs']],
  ...[['Staff', []], ['Pedidos', ['--orders']], ['Ventas', ['--sales']], ['Despachos', ['--deliveries']], ['Equipo', ['--team']], ['Revisión integral', ['--review']], ['API', ['--api']], ['Mercado Pago local', ['--api', '--mercadopago']]].map(([name, args]) => [name, ['scripts/check-staff-browser.mjs', ...args]]),
];
const report = { scope: 'local', startedAt: new Date().toISOString(), productionReady: false, externalValidation: 'pending', checks: [] };
for (const [name, args] of checks) {
  console.log(`\nValidación: ${name}`);
  const started = Date.now();
  const result = await new Promise(resolve => {
    const child = spawn(process.execPath, args, { cwd: root, stdio: 'inherit', windowsHide: true });
    const timer = setTimeout(() => { child.kill(); }, 180000);
    child.once('error', () => { clearTimeout(timer); resolve({ code: 1, reason: 'No se pudo iniciar la comprobación.' }); });
    child.once('close', (code, signal) => { clearTimeout(timer); resolve({ code: code ?? 1, ...(signal ? { reason: 'Comprobación interrumpida.' } : {}) }); });
  });
  report.checks.push({ name, passed: result.code === 0, durationMs: Date.now() - started, ...(result.reason ? { reason: result.reason } : {}) });
  if (result.code !== 0) { process.exitCode = 1; break; }
}
report.finishedAt = new Date().toISOString();
report.passed = report.checks.length === checks.length && report.checks.every(check => check.passed);
report.skipped = checks.slice(report.checks.length).map(([name]) => name);
const target = new URL('../.preview-browser/operation-report.json', import.meta.url);
await mkdir(new URL('./', target), { recursive: true });
await writeFile(target, JSON.stringify(report, null, 2) + '\n');
console.log(`\nValidación local ${report.passed ? 'aprobada' : 'fallida'}. Informe: .preview-browser/operation-report.json. Producción sigue pendiente.`);
