import cors from "cors";
import express from "express";
import jobRoutes from "./routes/job.routes";

const app = express();
const port = process.env.PORT ?? 3000;

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "field-service-api",
  });
});

app.use("/api/jobs", jobRoutes);

app.listen(port, () => {
  console.log(`API server running on port ${port}`);
});
