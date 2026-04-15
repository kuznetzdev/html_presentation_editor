"use strict";

const DEFAULT_TEST_SERVER_HOST = "127.0.0.1";
const DEFAULT_TEST_SERVER_PORT = 41731;

function normalizeOrigin(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

const TEST_SERVER_HOST =
  normalizeOrigin(process.env.PLAYWRIGHT_TEST_SERVER_HOST) ||
  DEFAULT_TEST_SERVER_HOST;

const parsedPort = Number(process.env.PLAYWRIGHT_TEST_SERVER_PORT || "");
const TEST_SERVER_PORT = Number.isFinite(parsedPort) && parsedPort > 0
  ? parsedPort
  : DEFAULT_TEST_SERVER_PORT;

const explicitOrigin = normalizeOrigin(process.env.PLAYWRIGHT_BASE_URL);
const TEST_SERVER_ORIGIN =
  explicitOrigin || `http://${TEST_SERVER_HOST}:${TEST_SERVER_PORT}`;

function toTestServerUrl(pathname = "/") {
  return new URL(pathname, `${TEST_SERVER_ORIGIN}/`).toString();
}

module.exports = {
  DEFAULT_TEST_SERVER_HOST,
  DEFAULT_TEST_SERVER_PORT,
  TEST_SERVER_HOST,
  TEST_SERVER_PORT,
  TEST_SERVER_ORIGIN,
  toTestServerUrl,
};
