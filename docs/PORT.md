# PORT CONFIGURATION

GraphQL server default port: 4100

If you need to change the port, update `listen: { port: XXXX }` in `src/index.ts`.

Reserved ports:

- 4000: Used by another process on this machine
- 4100: Used by FBS GraphQL server
