import { Bell, CircleHelp, Headphones, Home, Library, Menu, Search, Settings, ShieldCheck, SlidersHorizontal, Sparkles, TicketCheck, UserRound, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { NavLink, Outlet } from "react-router-dom";
import { Logo } from "../components/Logo";
import { OfflineBanner } from "../components/OfflineBanner";
import { Player } from "../features/player/Player";
import { repository } from "../repositories/localRepository";
import { useDatabaseVersion, useSession } from "../store/session";

const NavItem = ({ to, icon: Icon, label, badge }: { to: string; icon: typeof Home; label: string; badge?: number }) => <NavLink to={to} end={to === "/"} className={({ isActive }) => isActive ? "active" : ""}><Icon /><span>{label}</span>{Boolean(badge) && <b className="nav-badge">{badge}</b>}</NavLink>;

export function AppShell() {
  const { t, i18n } = useTranslation(); const user = useSession()!; useDatabaseVersion(); const [moreOpen, setMoreOpen] = useState(false);
  useEffect(() => { if (i18n.language !== user.locale) void i18n.changeLanguage(user.locale); }, [i18n, user.locale]);
  useEffect(() => { document.documentElement.dataset.theme = user.theme; }, [user.theme]);
  const unread = repository.notifications().filter((notice) => !notice.readAt).length;
  const isArtist = Boolean(user.artistProfile); const isStaff = user.kind === "support" || user.kind === "admin";
  return <div className="app-shell">
    <aside className="sidebar"><Logo />{!isStaff && <nav aria-label={t("primaryNavigation")}><NavItem to="/" icon={Home} label={t("home")} /><NavItem to="/search" icon={Search} label={t("search")} /><NavItem to="/library" icon={Library} label={t("library")} /><NavItem to="/notifications" icon={Bell} label={t("notifications")} badge={unread} /></nav>}
      {(isArtist || isStaff) && <><span className="nav-label">{isArtist ? t("artist") : t("supportRole")}</span><nav>{isArtist && <NavItem to="/studio" icon={Sparkles} label={t("studio")} />}{isStaff && <NavItem to="/support" icon={Headphones} label={t("support")} />}{user.kind === "admin" && <NavItem to="/admin" icon={ShieldCheck} label={t("admin")} />}</nav></>}
      <div className="sidebar-foot">{!isStaff && <NavItem to="/tickets" icon={TicketCheck} label={t("tickets")} />}{isStaff && <NavItem to="/notifications" icon={Bell} label={t("notifications")} badge={unread} />}<NavItem to="/settings" icon={Settings} label={t("settings")} /><NavItem to="/shortcuts" icon={CircleHelp} label={t("shortcuts")} />{!isStaff && <NavLink to={`/profile/${user.username}`}><UserRound /><span>{t("profile")}</span></NavLink>}</div>
    </aside>
    <header className="mobile-header"><Logo /><NavLink to="/notifications" className="icon-button" aria-label={t("notifications")}><Bell />{Boolean(unread) && <b className="nav-badge">{unread}</b>}</NavLink></header>
    <main className="main-content"><OfflineBanner /><Outlet /></main>
    <nav className="mobile-nav">{isStaff ? <><NavItem to={user.kind === "admin" ? "/admin" : "/support"} icon={user.kind === "admin" ? ShieldCheck : Headphones} label={t(user.kind === "admin" ? "admin" : "support")} /><NavItem to="/notifications" icon={Bell} label={t("notifications")} badge={unread} /><NavItem to="/settings" icon={Settings} label={t("settings")} /></> : <><NavItem to="/" icon={Home} label={t("home")} /><NavItem to="/search" icon={Search} label={t("search")} /><NavItem to="/library" icon={Library} label={t("library")} /><NavItem to="/notifications" icon={Bell} label={t("notifications")} badge={unread} /></>}<button className={moreOpen ? "active" : ""} onClick={() => setMoreOpen(!moreOpen)}>{moreOpen ? <X /> : <Menu />}<span>{t("more")}</span></button></nav>
    {moreOpen && <div className="mobile-more">{!isStaff && <><NavLink to={`/profile/${user.username}`} onClick={() => setMoreOpen(false)}><UserRound />{t("profile")}</NavLink><NavLink to="/tickets" onClick={() => setMoreOpen(false)}><TicketCheck />{t("tickets")}</NavLink></>}<NavLink to="/settings" onClick={() => setMoreOpen(false)}><SlidersHorizontal />{t("settings")}</NavLink>{isArtist && <NavLink to="/studio" onClick={() => setMoreOpen(false)}><Sparkles />{t("studio")}</NavLink>}{isStaff && <NavLink to="/support" onClick={() => setMoreOpen(false)}><Headphones />{t("support")}</NavLink>}{user.kind === "admin" && <NavLink to="/admin" onClick={() => setMoreOpen(false)}><ShieldCheck />{t("admin")}</NavLink>}<NavLink to="/shortcuts" onClick={() => setMoreOpen(false)}><CircleHelp />{t("shortcuts")}</NavLink></div>}
    {!isStaff && <Player />}
  </div>;
}
