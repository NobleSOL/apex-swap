import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders swap interface", () => {
  render(<App />);
  expect(
    screen.getByText(/swap instantly with deep ApeX liquidity/i)
  ).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /connect wallet/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /review swap/i })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /pools/i })).toBeInTheDocument();
});
