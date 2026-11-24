import { spawn } from 'node:child_process';

const proc = spawn('node', ['dist/index.js'], { stdio: ['pipe', 'pipe', 'inherit'] });
let buf = '';
proc.stdout.on('data', (d) => { buf += d; });

const send = (obj) => proc.stdin.write(JSON.stringify(obj) + '\n');
const readMsgs = () => buf.split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);

await new Promise((r) => setTimeout(r, 500));
send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'smoke', version: '0' } } });
await new Promise((r) => setTimeout(r, 500));
send({ jsonrpc: '2.0', method: 'notifications/initialized' });
send({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
await new Promise((r) => setTimeout(r, 500));
send({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'latest_version', arguments: { packages: ['http', 'provider'] } } });
await new Promise((r) => setTimeout(r, 2500));
send({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'pub_score', arguments: { package: 'provider' } } });
await new Promise((r) => setTimeout(r, 2000));

const msgs = readMsgs();
const tools = msgs.find((m) => m.id === 2)?.result?.tools;
console.log('TOOLS:', tools?.map((t) => t.name).join(', '));
const ver = msgs.find((m) => m.id === 3);
console.log('latest_version:', JSON.stringify(ver?.result?.content?.[0]?.text));
const score = msgs.find((m) => m.id === 4);
console.log('pub_score:', JSON.stringify(score?.result?.content?.[0]?.text));
proc.kill();
