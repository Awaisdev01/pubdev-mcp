<div align="center">

# pubdev-mcp

**MCP server for pub.dev — live Dart & Flutter package knowledge for Copilot agent mode and any MCP client.**

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![npm](https://img.shields.io/badge/npm-pubdev--mcp-blue)](https://www.npmjs.com/package/pubdev-mcp)

Zero API keys · Zero config · Node ≥ 18

</div>

---

## What it gives your agent

| Tool | What it does |
|---|---|
| `get_package` | Full package info: description, latest version, homepage, SDK constraints |
| `latest_version` | Latest versions of up to 20 packages at once (dependency bumps) |
| `get_changelog` | The CHANGELOG of a package version — know what changed before upgrading |
| `check_compatibility` | Compare your Flutter/Dart SDK constraints against a package's requirements |
| `pub_score` | pub.dev points, likes, downloads, platform tags — pick the healthy package |
| `search_packages` | Keyword search across pub.dev |

Works in: **GitHub Copilot agent mode** (VS Code, JetBrains), Claude Desktop, Cursor, and any MCP client.

## Install

### VS Code / GitHub Copilot

Add to `.vscode/mcp.json` (workspace) or user settings:

```json
{
  "servers": {
    "pubdev": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "pubdev-mcp"]
    }
  }
}
```

Then in Copilot Chat (agent mode): "#pubdev get_package http" or just ask
"what's the latest version of provider and will it work with my Flutter 3.24?"

### JetBrains (PyCharm / IntelliJ)

`~/.config/github-copilot/intellij/mcp.json`:

```json
{
  "servers": {
    "pubdev": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "pubdev-mcp"]
    }
  }
}
```

### Claude Desktop

`claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "pubdev": { "command": "npx", "args": ["-y", "pubdev-mcp"] }
  }
}
```

## How it works

Straight HTTP calls to the public pub.dev API — no keys, no scraping, no
rate-limit tricks. Results are formatted as compact markdown so agent
context stays small.

## License

MIT — see [LICENSE](LICENSE).
