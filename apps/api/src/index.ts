import "./bootstrap";
import "./config/dns";

import app from "./app";
import { connectToDatabase } from "./config/db";

// Connect to MongoDB
const PORT = Number(process.env.PORT) || 5000;

const startServer = async () => {
  try {
    await connectToDatabase();

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Error starting server:", error);
    process.exit(1);
  }
};

startServer();
