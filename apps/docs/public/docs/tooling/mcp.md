# Registries for AI assistants
Source: https://site.kirana-style.workers.dev/docs/tooling/mcp

# Registries for AI assistants

`kirana-style ui mcp` is a [Model Context Protocol](https://modelcontextprotocol.io)
server for your project. An assistant that speaks the protocol can search your
registries, read what an item is and what its files hold, and get the command
that installs it, without you pasting any of it in.

It runs over stdio from your project's directory, with the
`@kirana-style/registry` package your project already has for
[`kirana-style ui`](/docs/tooling/components). Tell your assistant the command:

```bash
claude mcp add kirana -- npx kirana-style ui mcp   # Claude Code
```

Clients that read a JSON file of servers, such as `.mcp.json` or Cursor's
`.cursor/mcp.json`, take the same command:

```json
{
  "mcpServers": {
    "kirana": { "command": "npx", "args": ["kirana-style", "ui", "mcp"] }
  }
}
```

## Its tools

| Tool              | Gives                                                                                                                            |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `list_registries` | Your registries, each namespace and its URL, and the project's framework, base and icon library. A registry's headers stay out.  |
| `search_items`    | The items whose name, title or description holds every word of a query, from every registry or those named, as `ui search` does. |
| `view_items`      | What each item is and what installing it brings, as `ui view` prints it.                                                         |
| `get_item_files`  | An item's files with their content, for your project's framework (or the one asked for) and every base, or the base asked for.   |
| `get_add_command` | The `kirana-style ui add` command for those items, with your package manager.                                                    |

The server reads; it never writes to your project. To install, the assistant runs
the command `get_add_command` gives, which writes files as `ui add` always does:
your aliases, your icon library, the lockfile and the check after. Your
`kirana.config` is read again for every call, so a registry you add is seen at
once.

It needs no package beyond `@kirana-style/registry`, and speaks the protocol's
revisions from 2024-11-05 on.
