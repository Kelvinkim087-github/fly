// Configuration for API endpoints
const isDevelopment = process.env.NODE_ENV === "development";

export const API_BASE_URL = isDevelopment
  ? "https://server-dnkw.onrender.com"
  : process.env.REACT_APP_API_URL || "https://server-dnkw.onrender.com";

export default {
  API_BASE_URL,
};
