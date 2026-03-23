// Browser worker entry point

const start = async () => {
  console.log('Browser worker starting...');
  // TODO: Initialize browser worker and register tasks
};

const shutdown = async () => {
  console.log('Browser worker shutting down...');
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

start().catch((err) => {
  console.error('Failed to start browser worker:', err);
  process.exit(1);
});
