import { createAppServer } from "./create-app-server.ts";
import { META } from "./data-sources/flow-api.ts";

const PORT = Number(process.env.FLOW_API_PORT ?? 17100);

const app = await createAppServer();

app.listen(PORT, () => {
  process.stdout.write(`flow-app bff on http://localhost:${PORT}/graphql (registry: ${META})\n`);
});
