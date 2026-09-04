/*
 * Browser-safe configuration only. Never put RunPod, cloud-storage, or other
 * provider secrets in this file: the browser can read everything here.
 *
 * Eve's private teacher service runs on this computer by default. The API key
 * belongs only in gpu-service/api/.env — never in this browser-delivered file.
 */
window.BUILD_AI_CONFIG = { apiBaseUrl: "http://127.0.0.1:8787" };
