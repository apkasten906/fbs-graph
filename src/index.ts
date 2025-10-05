import { startStandaloneServer } from '@apollo/server/standalone';

import { createApolloServer } from './server.js';

const server = createApolloServer();
const port = Number.parseInt(process.env.PORT ?? '4100', 10);

const { url } = await startStandaloneServer(server, {
  listen: { port }
});

console.log(`🚀 GraphQL ready at ${url}`);
