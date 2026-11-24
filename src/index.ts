/**
 * pubdev-mcp — Model Context Protocol server for pub.dev.
 *
 * Gives Copilot agent mode (and any MCP client) live pub.dev knowledge for
 * Dart & Flutter projects: package metadata, changelogs, versions, scores,
 * and Flutter/Dart SDK compatibility.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const PUB_API = 'https://pub.dev/api';
const UA = 'pubdev-mcp/0.1 (MCP server; +https://github.com/Awaisdev01/pubdev-mcp)';

async function pubGet<T>(path: string): Promise<T> {
  const res = await fetch(`${PUB_API}${path}`, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`pub.dev ${res.status} for ${path}`);
  }
  return res.json() as Promise<T>;
}

interface PubPackage {
  name: string;
  versions: string[];
  latest: { version: string; pubspec: Record<string, unknown> };
}

interface PubScore {
  grantedPoints?: number;
  maxPoints?: number;
  likeCount?: number;
  downloadCount30Days?: number;
  tags?: string[];
}

function compatSummary(pkg: PubPackage): string {
  const pubspec = pkg.latest?.pubspec ?? {};
  const sdk = pubspec['environment'] ?? {};
  const lines: string[] = [];
  for (const [k, v] of Object.entries(sdk as Record<string, unknown>)) {
    lines.push(`- ${k}: ${v}`);
  }
  return lines.length ? lines.join('\n') : '(no SDK constraints published)';
}

const server = new McpServer(
  { name: 'pubdev-mcp', version: '0.1.0' },
  { capabilities: { tools: {} } }
);

// ── tool: get_package ────────────────────────────────────────────────────
server.tool(
  'get_package',
  'Get full pub.dev info for a Dart/Flutter package: description, latest version, homepage, SDK constraints, publish date. Use when a task mentions a pub.dev package.',
  { package: z.string().min(1).describe('pub.dev package name, e.g. http or provider') },
  async ({ package: name }) => {
    const pkg = await pubGet<PubPackage>(`/packages/${encodeURIComponent(name)}`);
    const latest = pkg.latest;
    const text = [
      `**${pkg.name}** (latest: ${latest?.version})`,
      `description: ${latest?.pubspec?.['description'] ?? '—'}`,
      `homepage: ${latest?.pubspec?.['homepage'] ?? '—'}`,
      `repository: ${latest?.pubspec?.['repository'] ?? '—'}`,
      `published versions: ${pkg.versions.length}`,
      `SDK constraints:\n${compatSummary(pkg)}`,
    ].join('\n');
    return { content: [{ type: 'text' as const, text }] };
  }
);

// ── tool: latest_version ─────────────────────────────────────────────────
server.tool(
  'latest_version',
  'Get just the latest version number(s) of one or more pub.dev packages. Fast; use for dependency bumps.',
  { packages: z.array(z.string()).describe('one or more pub.dev package names') },
  async ({ packages }) => {
    const lines: string[] = [];
    for (const name of packages.slice(0, 20)) {
      try {
        const pkg = await pubGet<PubPackage>(`/packages/${encodeURIComponent(name)}`);
        lines.push(`${pkg.name}: ${pkg.latest?.version}`);
      } catch (e) {
        lines.push(`${name}: not found (${(e as Error).message})`);
      }
    }
    return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
  }
);

// ── tool: get_changelog ──────────────────────────────────────────────────
server.tool(
  'get_changelog',
  'Fetch the CHANGELOG.md of a pub.dev package version (latest or specific). Use before upgrading a dependency to learn what changed.',
  {
    package: z.string().min(1),
    version: z.string().optional().describe('specific version, omit for latest'),
  },
  async ({ package: name, version }) => {
    const res = await fetch(
      `https://pub.dev/packages/${encodeURIComponent(name)}/versions/${encodeURIComponent(version ?? '')}/changelog`,
      { headers: { 'User-Agent': UA, Accept: 'text/html' } }
    );
    if (!res.ok) throw new Error(`pub.dev ${res.status}`);
    const html = await res.text();
    const m = /<article[^>]*>([\s\S]*?)<\/article>/.exec(html);
    let text = m ? m[1] : html;
    text = text
      .replace(/<script[\s\S]*?<\/script>/g, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      .replace(/[ \t]+/g, ' ')
      .replace(/\n\s*\n+/g, '\n\n')
      .trim();
    if (text.length > 8000) text = text.slice(0, 8000) + '\n… (truncated)';
    return { content: [{ type: 'text' as const, text }] };
  }
);

// ── tool: check_compatibility ────────────────────────────────────────────
server.tool(
  'check_compatibility',
  'Check whether a package version supports your Flutter/Dart SDK. Pass the package name and your SDK constraints (e.g. dart: ^3.5.0, flutter: ^3.24.0).',
  {
    package: z.string().min(1),
    dart: z.string().optional().describe('your Dart SDK constraint'),
    flutter: z.string().optional().describe('your Flutter SDK constraint'),
  },
  async ({ package: name, dart, flutter }) => {
    const pkg = await pubGet<PubPackage>(`/packages/${encodeURIComponent(name)}`);
    const env = (pkg.latest?.pubspec?.['environment'] ?? {}) as Record<string, string>;
    const checks: string[] = [];
    if (dart) checks.push(`dart: yours ${dart} vs package ${env['sdk'] ?? 'unspecified'} → ${env['sdk'] ? 'verify overlap' : 'no constraint'}`);
    if (flutter) checks.push(`flutter: yours ${flutter} vs package ${env['flutter'] ?? 'unspecified'} → ${env['flutter'] ? 'verify overlap' : 'no constraint'}`);
    const text = [
      `${pkg.name} ${pkg.latest?.version} requires:`,
      ...Object.entries(env).map(([k, v]) => `- ${k}: ${v}`),
      '',
      ...checks,
    ].join('\n');
    return { content: [{ type: 'text' as const, text }] };
  }
);

// ── tool: pub_score ──────────────────────────────────────────────────────
server.tool(
  'pub_score',
  'Get pub.dev quality/score metrics for a package: points, likes, downloads, platform tags. Use when choosing between alternative packages.',
  { package: z.string().min(1) },
  async ({ package: name }) => {
    const s = await pubGet<PubScore>(`/packages/${encodeURIComponent(name)}/score`);
    const tags = (s.tags ?? []).filter((t) => t.startsWith('platform:')).join(', ') || 'none listed';
    const text = [
      `**${name}** score:`,
      `- points: ${s.grantedPoints ?? '?'}/${s.maxPoints ?? '?'}`,
      `- likes: ${s.likeCount ?? '?'}`,
      `- downloads (30d): ${s.downloadCount30Days ?? '?'}`,
      `- platforms: ${tags}`,
    ].join('\n');
    return { content: [{ type: 'text' as const, text }] };
  }
);

// ── tool: search_packages ────────────────────────────────────────────────
server.tool(
  'search_packages',
  'Search pub.dev packages by keyword, sorted by relevance. Returns names + short descriptions.',
  { query: z.string().min(1).describe('search keywords') },
  async ({ query }) => {
    const res = await fetch(
      `https://pub.dev/api/search?q=${encodeURIComponent(query)}`,
      { headers: { 'User-Agent': UA } }
    );
    if (!res.ok) throw new Error(`pub.dev ${res.status}`);
    const data = (await res.json()) as { packageNames?: string[] };
    const names = (data.packageNames ?? []).slice(0, 10);
    const lines: string[] = [];
    for (const name of names) {
      try {
        const pkg = await pubGet<PubPackage>(`/packages/${name}`);
        lines.push(`- ${pkg.name}: ${String(pkg.latest?.pubspec?.['description'] ?? '').slice(0, 100)}`);
      } catch {
        lines.push(`- ${name}`);
      }
    }
    return { content: [{ type: 'text' as const, text: lines.join('\n') || '(no results)' }] };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('pubdev-mcp running on stdio');
}

main().catch((err) => {
  console.error('fatal:', err);
  process.exit(1);
});
