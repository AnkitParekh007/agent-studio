# Skills, MCP & Knowledge

Agents need tools — but enterprise agents need **catalogs**, not unbounded shell access.

## Skills

Version-aware skill definitions the agent may invoke under policy.

## MCP

- Catalog + `tools/list`
- Local `mcp:` tool calls for approved servers
- SSRF guards: HTTPS required, unsafe destinations blocked

Publication tokens must not reach privileged MCP operator surfaces (`smoke:authz` covers this).

## Knowledge

Knowledge sources can be attached and fetched server-side with the same outbound URL safety rules.

> [!NOTE]
> Claude-native MCP transport may deepen later; today the control plane owns catalog + mediation so AuthZ stays coherent.
