import cors from "cors";
import express from "express";
import { setupSwagger } from "./config/swagger";
import { errorHandler } from "./middleware/error-handler";
import jobRoutes from "./routes/job.routes";

const app = express();

app.use(cors());
app.use(express.json());

setupSwagger(app);

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
  });
});

app.use("/api/jobs", jobRoutes);
app.use(errorHandler);

export default app;
