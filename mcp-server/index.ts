import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { mcpTools } from "./tools"
import { executeTool } from "../lib/ai/tool-executor"

const server = new McpServer({
  name: "workos-task-mcp",
  version: "1.0.0",
})

for (const tool of mcpTools) {
  server.registerTool(
    tool.name,
    {
      description: tool.description,
      inputSchema: tool.inputSchema,
    },
    async (args) => {
      try {
        const result = await executeTool(tool.name, (args ?? {}) as Record<string, unknown>)

        return {
          content: [{ type: "text", text: JSON.stringify(result) }],
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error(`[mcp] Tool ${tool.name} failed:`, message)

        return {
          isError: true,
          content: [{ type: "text", text: JSON.stringify({ error: message }) }],
        }
      }
    },
  )
}

const startServer = async () => {
  const transport = new StdioServerTransport()

  const shutdown = async () => {
    try {
      await transport.close()
    } catch (error) {
      console.error("[mcp] Error during shutdown:", error)
    } finally {
      process.exit(0)
    }
  }

  process.on("SIGINT", shutdown)
  process.on("SIGTERM", shutdown)

  console.info("[mcp] WorkOS MCP server ready (stdio transport)")
  await server.connect(transport)
}

startServer().catch((error) => {
  console.error("[mcp] Failed to start server:", error)
  process.exit(1)
})
