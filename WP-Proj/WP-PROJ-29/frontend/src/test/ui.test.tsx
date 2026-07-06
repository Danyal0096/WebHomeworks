import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import App from "../app/App";
import i18n from "../i18n";
import { repository } from "../repositories/localRepository";

describe("critical UI flows", () => {
  beforeEach(async () => { repository.reset(); await i18n.changeLanguage("en"); });

  it("renders demo login and signs in a selected account", async () => {
    const user = userEvent.setup(); render(<MemoryRouter initialEntries={["/login"]}><App /></MemoryRouter>); await user.click(screen.getByRole("button", { name: /Use a demo account/i })); await user.click(screen.getByRole("button", { name: /Nila · Basic/i })); expect(await screen.findByText("Recently played")).toBeInTheDocument();
  });

  it("redirects unauthenticated protected routes to login", () => {
    render(<MemoryRouter initialEntries={["/admin"]}><App /></MemoryRouter>); expect(screen.getByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
  });

  it("enforces the admin route gate for listeners", async () => {
    repository.login("listener.gold@sonora.demo", "DemoPass123!"); render(<MemoryRouter initialEntries={["/admin"]}><App /></MemoryRouter>); expect(await screen.findByText("This space is not available for your account.")).toBeInTheDocument();
  });

  it("switches the visible UI language and persists it", async () => {
    repository.login("listener.gold@sonora.demo", "DemoPass123!"); const view = render(<MemoryRouter initialEntries={["/settings"]}><App /></MemoryRouter>); const language = screen.getByLabelText("Language"); fireEvent.change(language, { target: { value: "de" } }); expect(await screen.findByRole("heading", { name: "Einstellungen" })).toBeInTheDocument(); expect(repository.sessionUser()?.locale).toBe("de"); view.unmount();
  });

  it("ships complete key coverage for all six UI dictionaries", () => {
    const languages = ["en", "es", "de", "fr", "ru", "zh-CN"];
    const english = Object.keys(i18n.getResourceBundle("en", "translation"));
    languages.forEach((language) => expect(Object.keys(i18n.getResourceBundle(language, "translation")).sort()).toEqual([...english].sort()));
  });

  it("redirects staff home to internal tools and omits the consumer player", async () => {
    repository.login("support@sonora.demo", "DemoPass123!"); const view = render(<MemoryRouter initialEntries={["/"]}><App /></MemoryRouter>); expect(await screen.findByRole("heading", { name: "Support desk" })).toBeInTheDocument(); expect(view.container.querySelector("audio")).toBeNull();
  });
});
