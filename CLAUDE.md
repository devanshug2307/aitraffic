# CLAUDE.md

Claude Code should follow [AGENTS.md](AGENTS.md) as the canonical engineering contract.

## Claude Code workflow

```bash
npm install
npm run build
npm run check
```

The project-scoped MCP server is declared in `.mcp.json`. Build the project before starting it.

Useful commands:

```bash
node dist/src/cli.js doctor --format json
node dist/src/cli.js schema evidence --format json
node dist/src/cli.js logs import examples/sample-access.log --format json
```

When proposing a change:

1. Cite the observed evidence.
2. Label inferences.
3. Produce a reviewable diff.
4. Run `npm run check`.
5. State what remains unknown.

Do not present GEO/SEO heuristics as platform ranking factors.
