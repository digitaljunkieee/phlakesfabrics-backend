import app from './app';

const logger = require('../lib/logger');

const port = process.env.PORT || 3000;
const server = app.listen(port, () => {
  logger.info(`Express API server listening on ${port}`);
});

server.on('error', (error: Error) => {
  logger.error('Failed to start Express API server', { message: error.message });
  process.exit(1);
});
