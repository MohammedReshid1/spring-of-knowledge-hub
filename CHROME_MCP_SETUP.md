# Chrome MCP Setup Complete ✅

## Configuration Status

Your Claude Desktop now has **TWO** Chrome MCP servers configured:

### 1. **chrome-mcp-stdio** (mcp-chrome-bridge)
- Location: `/opt/homebrew/lib/node_modules/mcp-chrome-bridge`
- Already installed and configured

### 2. **chrome-devtools** (chrome-devtools-mcp)
- Newly added to your project
- Uses the latest chrome-devtools-mcp package

## Configuration File

**Location**: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "chrome-mcp-stdio": {
      "command": "npx",
      "args": [
        "node",
        "/opt/homebrew/lib/node_modules/mcp-chrome-bridge/dist/mcp/mcp-server-stdio.js"
      ]
    },
    "chrome-devtools": {
      "command": "npx",
      "args": [
        "-y",
        "chrome-devtools-mcp"
      ],
      "env": {}
    }
  }
}
```

## Next Steps

### 1. Restart Claude Desktop
**Important**: You must restart Claude Desktop for the MCP server changes to take effect.

```bash
# On macOS, you can restart Claude Desktop by:
# 1. Quit Claude Desktop (Cmd+Q)
# 2. Reopen Claude Desktop from Applications
```

### 2. Verify MCP Tools are Available

After restarting Claude Desktop, check if the chrome MCP tools are available in this conversation. You should see tools like:
- `mcp__chrome-devtools__*` (various Chrome DevTools commands)
- Navigation, screenshots, console access, etc.

### 3. Test the Timetable Fix with Chrome MCP

Once the MCP tools are available, you can:

1. **Navigate to the app**:
   ```
   Use chrome MCP to navigate to http://localhost:8081
   ```

2. **Take screenshots** of the Timetable Management page

3. **Inspect console** for any errors

4. **Test all three view modes**:
   - Class View
   - Teacher View
   - Room View (the one that was fixed)

## Available Chrome MCP Options

The chrome-devtools-mcp supports:

- `--headless` - Run without UI
- `--browserUrl` - Connect to existing Chrome instance
- `--viewport` - Set initial viewport size (e.g., "1280x720")
- `--channel` - Use different Chrome channel (stable, canary, beta, dev)
- `--logFile` - Save debug logs to file

## Troubleshooting

### If MCP tools don't appear after restart:

1. **Check config syntax**:
   ```bash
   cat ~/Library/Application\ Support/Claude/claude_desktop_config.json | jq
   ```

2. **Verify chrome-devtools-mcp is accessible**:
   ```bash
   npx -y chrome-devtools-mcp --help
   ```

3. **Check Claude Desktop logs**:
   - On macOS: `~/Library/Logs/Claude/`

### If chrome-devtools-mcp fails to start:

Make sure you have Chrome installed:
```bash
# Check Chrome installation
ls -la /Applications/Google\ Chrome.app
```

## Testing the Timetable View Fix

Once Chrome MCP is working:

1. Navigate to http://localhost:8081/timetable (or wherever the timetable page is)
2. Test the Room View mode specifically (this was the broken feature we fixed)
3. Take screenshots to verify the fix works
4. Check browser console for any errors

## What Was Fixed

The Timetable View had two issues:
1. **Room View Mode not working** - Fixed by adding proper room filtering logic
2. **Debug console clutter** - Removed verbose logging

See `TIMETABLE_VIEW_FIX.md` for complete technical details.
