import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders swap interface", () => {
  render(<App />);
  expect(screen.getByText(/trade digital assets seamlessly/i)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /connect/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /swap/i })).toBeInTheDocument();
});
