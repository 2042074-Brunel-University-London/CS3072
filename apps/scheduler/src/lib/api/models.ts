import axios from "axios";

// TODO: move to .env
const BASE_URL = "http://127.0.0.1:8000";

export const modelsAPIClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});
