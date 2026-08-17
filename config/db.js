import mongoose from "mongoose";
import dns from "node:dns";

class Database {
  constructor() {
    if (!Database.instance) {
      this.isConnected = false;
      Database.instance = this;
    }
    return Database.instance;
  }

  async connect() {
    if (this.isConnected) {
      console.log("Using existing database connection");
      return;
    }

    try {
      const uri = process.env.MONGODB_URL;

      if (typeof uri !== "string" || uri.trim().length === 0) {
        throw new Error(
          "MongoDB connection string is missing. Set MONGODB_URL in your .env file.",
        );
      }

      try {
        await mongoose.connect(uri);
      } catch (error) {
        const isSrvDnsRefused =
          error?.code === "ECONNREFUSED" && error?.syscall === "querySrv";

        if (!isSrvDnsRefused) {
          throw error;
        }

        // Fallback for networks where the default DNS resolver refuses SRV lookups.
        dns.setServers(["8.8.8.8", "1.1.1.1"]);
        console.log(
          "Default DNS resolver refused SRV lookup. Retrying MongoDB connection with public DNS resolvers...",
        );
        await mongoose.connect(uri);
      }

      this.isConnected = true;
      console.log(
        "Mongodb Database Connected Succesfully",
        mongoose.connection.host,
      );
    } catch (error) {
      console.log("Mongodb Database Connection Failed", error);
      process.exit(1);
    }
  }

  async disconnect() {
    if (!this.isConnected) {
      return;
    }
    try {
      await mongoose.connection.close();
      this.isConnected = false;
      console.log("Mongodb Database Disconnected Succesfully");
    } catch (error) {
      console.log("Mongodb Database Disconnection Failed", error);
    }
  }
}

const instance = new Database();

export default instance;
