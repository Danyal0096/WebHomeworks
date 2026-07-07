import { readFileSync } from "node:fs";
import { join } from "node:path";
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

  it("restores persisted locale and theme when the app shell mounts", async () => {
    repository.login("listener.gold@sonora.demo", "DemoPass123!");
    repository.updateSettings({ locale: "fr", theme: "light" });
    render(<MemoryRouter initialEntries={["/settings"]}><App /></MemoryRouter>);
    expect(await screen.findByRole("heading", { name: "Réglages" })).toBeInTheDocument();
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("ships complete key coverage for all six UI dictionaries", () => {
    const languages = ["en", "es", "de", "fr", "ru", "zh-CN"];
    const english = Object.keys(i18n.getResourceBundle("en", "translation"));
    languages.forEach((language) => expect(Object.keys(i18n.getResourceBundle(language, "translation")).sort()).toEqual([...english].sort()));
  });

  it("translates high-risk UI areas without falling back to English copy", () => {
    const keys = ["settingsTitle", "checkoutTitle", "profileImageTitle", "notificationTitle", "ticketGate", "admin", "studio", "artist", "likedEmpty", "historyEmpty", "playerError"];
    const english = i18n.getResourceBundle("en", "translation") as Record<string, string>;
    ["es", "de", "fr", "ru", "zh-CN"].forEach((language) => {
      const bundle = i18n.getResourceBundle(language, "translation") as Record<string, string>;
      keys.forEach((key) => expect(bundle[key], `${language}.${key}`).not.toBe(english[key]));
    });
  });

  it("keeps light mode connected to shell, player, mobile, and modal theme variables", () => {
    const css = readFileSync(join(process.cwd(), "src", "styles", "global.css"), "utf8");
    expect(css).toContain(':root[data-theme="light"]');
    expect(css).toContain("--shell-bg");
    expect(css).toContain("background:var(--shell-bg)");
    expect(css).toContain("background:var(--player-bg)");
    expect(css).toContain("background:var(--mobile-shell-bg)");
    expect(css).toContain("background:var(--full-player-bg)");
  });

  it("requires explicit mock checkout confirmation before activating a subscription", async () => {
    const user = userEvent.setup();
    repository.login("listener.basic@sonora.demo", "DemoPass123!");
    render(<MemoryRouter initialEntries={["/settings"]}><App /></MemoryRouter>);
    await user.click(screen.getByRole("button", { name: /Explore plans/i }));
    const oneMonthSilver = screen.getAllByRole("button", { name: /Silver/i }).find((button) => button.textContent?.includes("· 1 "));
    expect(oneMonthSilver).toBeDefined();
    await user.click(oneMonthSilver!);
    expect(repository.sessionUser()?.subscription.tier).toBe("basic");
    expect(screen.getByText(/Final amount/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Confirm demo checkout/i }));
    expect(repository.sessionUser()?.subscription.tier).toBe("silver");
  });

  it("renders real Liked Songs and Listening History library views", () => {
    repository.login("listener.basic@sonora.demo", "DemoPass123!");
    const liked = render(<MemoryRouter initialEntries={["/library/liked"]}><App /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "Liked Songs" })).toBeInTheDocument();
    expect(screen.getByText("Afterglow Index")).toBeInTheDocument();
    liked.unmount();
    render(<MemoryRouter initialEntries={["/library/history"]}><App /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "Listening history" })).toBeInTheDocument();
    expect(screen.getByText("Night Geometry")).toBeInTheDocument();
  });

  it("blocks Basic profile image edits and persists a validated local image for Silver", async () => {
    const user = userEvent.setup();
    repository.login("listener.basic@sonora.demo", "DemoPass123!");
    const basicView = render(<MemoryRouter initialEntries={["/settings"]}><App /></MemoryRouter>);
    await user.click(screen.getByRole("button", { name: /Change profile image/i }));
    expect(screen.getAllByText("Profile images require Silver or Gold.").length).toBeGreaterThan(0);
    basicView.unmount();

    repository.logout();
    repository.login("listener.silver@sonora.demo", "DemoPass123!");
    const silverView = render(<MemoryRouter initialEntries={["/settings"]}><App /></MemoryRouter>);
    const file = new File([new Uint8Array([137, 80, 78, 71, 13, 10])], "avatar.png", { type: "image/png" });
    const fileInput = silverView.container.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, file);
    const dialog = await screen.findByRole("heading", { name: "Preview selected image" });
    expect(dialog).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Use this image" }));
    expect(repository.sessionUser()?.avatarUrl?.startsWith("data:image/png;base64,")).toBe(true);
  });

  it("redirects staff home to internal tools and omits the consumer player", async () => {
    repository.login("support@sonora.demo", "DemoPass123!"); const view = render(<MemoryRouter initialEntries={["/"]}><App /></MemoryRouter>); expect(await screen.findByRole("heading", { name: "Support desk" })).toBeInTheDocument(); expect(view.container.querySelector("audio")).toBeNull();
  });
});
