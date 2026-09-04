/*
 * Browser-safe configuration only. Never put RunPod, cloud-storage, or other
 * provider secrets in this file: the browser can read everything here.
 *
 * Set apiBaseUrl after deploying gpu-service/api, for example:
 * window.BUILD_AI_CONFIG = { apiBaseUrl: "https://api.example.com" };
 */
window.BUILD_AI_CONFIG = { apiBaseUrl: "" };
