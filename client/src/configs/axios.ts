import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_BASE_URL || "https://website-builder-backend.onrender.com",
  withCredentials: true,
});

export default api;

