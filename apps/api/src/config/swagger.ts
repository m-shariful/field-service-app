// swagger-ui-express doesn't define your API. It simply takes your OpenAPI specification and renders it as a browser-based documentation interface.
// https://swagger.io/docs/open-source-tools/swagger-ui/usage/configuration/

// For interactive API explorer, you can use the Swagger UI interface at /api/docs. This interface allows you to view and test the API endpoints defined in your OpenAPI specification.

import type { Express } from "express";
import path from "node:path";
import swaggerUi from "swagger-ui-express";
import yaml from "yamljs";

// Learning: OpenAPI is kept as a separate YAML contract,
// while Swagger UI is responsible only for displaying it.
const openApiPath = path.resolve(process.cwd(), "docs", "openapi.yaml");

const openApiDocument = yaml.load(openApiPath);

export function setupSwagger(app: Express) {
  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openApiDocument));
}
