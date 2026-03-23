// MCP gateway entry point

const start = async () => {
  console.log('MCP gateway starting...');
  // TODO: Initialize MCP gateway and register tools/resources
};

const shutdown = async () => {
  console.log('MCP gateway shutting down...');
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

start().catch((err) => {
  console.error('Failed to start MCP gateway:', err);
  process.exit(1);
});
