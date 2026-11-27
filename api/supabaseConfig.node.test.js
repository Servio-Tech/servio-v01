import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { getSupabaseConfig } from "./supabaseConfig.js";

describe("server Supabase configuration", () => {
  test("accepts the Vite variables used by the deployed browser build", () => {
    assert.deepEqual(getSupabaseConfig({
      VITE_SUPABASE_URL: "https://project.example.supabase.co",
      VITE_SUPABASE_KEY: "public-anon-key",
    }), {
      url: "https://project.example.supabase.co",
      key: "public-anon-key",
    });
  });

  test("prefers explicit server variables over Vite and legacy names", () => {
    assert.deepEqual(getSupabaseConfig({
      SUPABASE_URL: "https://server.example.supabase.co",
      VITE_SUPABASE_URL: "https://vite.example.supabase.co",
      SUPABASE_ANON_KEY: "server-key",
      VITE_SUPABASE_KEY: "vite-key",
    }), {
      url: "https://server.example.supabase.co",
      key: "server-key",
    });
  });

  test("retains compatibility with the legacy React-prefixed names", () => {
    assert.deepEqual(getSupabaseConfig({
      REACT_APP_SUPABASE_URL: "https://legacy.example.supabase.co",
      REACT_APP_SUPABASE_KEY: "legacy-key",
    }), {
      url: "https://legacy.example.supabase.co",
      key: "legacy-key",
    });
  });
});
