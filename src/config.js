// Configuration for API endpoints
const isDevelopment = process.env.NODE_ENV === "development";

export const API_BASE_URL = isDevelopment
  ? "http://localhost:3500"
  : process.env.REACT_APP_API_URL || "http://localhost:3500";

export default {
  API_BASE_URL,
};
