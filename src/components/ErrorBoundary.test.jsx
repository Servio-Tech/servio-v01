import React from "react";
import { render, screen } from "@testing-library/react";
import ErrorBoundary from "./ErrorBoundary";

function Failure() { throw new Error("Chunk failed to load"); }

test("shows a recovery action even outside the language provider", () => {
  const previous = document.documentElement.lang;
  document.documentElement.lang = "en";
  const log = jest.spyOn(console, "error").mockImplementation(() => {});
  render(<ErrorBoundary><Failure /></ErrorBoundary>);
  expect(screen.getByText("Unexpected error")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Reload page" })).toBeInTheDocument();
  log.mockRestore();
  document.documentElement.lang = previous;
});
