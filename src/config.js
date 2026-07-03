// Configuration for API endpoints
const isDevelopment = process.env.NODE_ENV === "development";

export const API_BASE_URL = isDevelopment
  ? "https://server-curious-song-2077.fly.dev"
  : process.env.REACT_APP_API_URL || "https://server-curious-song-2077.fly.dev";

export default {
  API_BASE_URL,
};
