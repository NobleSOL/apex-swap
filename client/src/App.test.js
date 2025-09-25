import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders swap interface", () => {
  render(<App />);
  expect(
    screen.getByText(/swap at apex speed with silverback/i)
  ).toBeInTheDocument();
  expect(screen.getAllByRole("button", { name: /connect/i }).length).toBeGreaterThan(0);
  expect(screen.getByRole("button", { name: /^swap$/i })).toBeInTheDocument();
  expect(screen.getAllByRole("link", { name: /pools/i }).length).toBeGreaterThan(0);
});
