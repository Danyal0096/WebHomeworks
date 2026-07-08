import { Bell, Check, ChevronRight, CircleDollarSign, Download, Image, LockKeyhole, LogOut, MonitorSmartphone, RotateCcw, SlidersHorizontal, Trash2, Users, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { canDownload, canEditAvatar, canUseRooms } from "../../domain/entitlements";
import type { SubscriptionPlan } from "../../domain/types";
import { locales } from "../../i18n";
import { repository } from "../../repositories/localRepository";
import { useDatabaseVersion, useSession } from "../../store/session";
import { uiError } from "../shared/errors";

const PROFILE_IMAGE_MAX_BYTES = 50 * 1024 * 1024;
const PROFILE_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const LOGOUT_TOAST_KEY = "sonora:logout-toast";

export function SettingsPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const user = useSession()!;
  useDatabaseVersion();
  const db = repository.database();
  const usesApi = Boolean((repository as unknown as { usesApi?: boolean }).usesApi);
  const userPayments = db.payments.filter((payment) => payment.userId === user.id).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const [plansOpen, setPlansOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [checkoutPlan, setCheckoutPlan] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [checkoutMessage, setCheckoutMessage] = useState("");
  const [username, setUsername] = useState(user.username);
  const [avatarDraft, setAvatarDraft] = useState<{ file: File; src: string; name: string } | null>(null);
  const avatarInput = useRef<HTMLInputElement>(null);
  const selectedPlan = db.plans.find((plan) => plan.id === checkoutPlan) ?? null;

  useEffect(() => { document.documentElement.dataset.theme = user.theme; }, [user.theme]);

  const setLanguage = (locale: typeof user.locale) => {
    repository.updateSettings({ locale });
    void i18n.changeLanguage(locale);
  };

  const formatToman = (rial: number) => `${Math.round(rial / 10).toLocaleString(user.locale)} ${t("toman")}`;
  const isBlocked = (plan: SubscriptionPlan | null) => {
    if (!plan) return null;
    if (user.subscription.status === "active" && user.subscription.tier === plan.tier) return "sameTierCheckoutBlocked";
    if (user.subscription.status === "active" && user.subscription.tier === "gold" && plan.tier === "silver" && user.subscription.expiresAt && new Date(user.subscription.expiresAt) > new Date()) return "downgradeCheckoutBlocked";
    return null;
  };
  const consequence = (plan: SubscriptionPlan | null) => {
    const block = isBlocked(plan);
    if (block) return t(block);
    if (!plan) return t("checkoutSelectPlan");
    if (user.subscription.tier === "silver" && plan.tier === "gold") return t("silverToGoldWarning");
    if (user.subscription.tier === "basic") return t("basicToPaidConsequence");
    return t("paidSwitchConsequence");
  };
  const purchase = () => {
    const block = isBlocked(selectedPlan);
    if (!selectedPlan) { setCheckoutMessage(t("checkoutSelectPlan")); return; }
    if (block) { setCheckoutMessage(t(block)); return; }
    Promise.resolve(repository.purchase(selectedPlan.id))
      .then(() => {
        setCheckoutPlan(null);
        setPlansOpen(false);
        setCheckoutMessage("");
        setMessage(t("checkoutComplete"));
      })
      .catch((reason) => setCheckoutMessage(uiError(reason, t)));
  };
  const chooseAvatar = () => {
    if (!canEditAvatar(user.subscription.tier)) { setMessage(t("profileImageGate")); return; }
    avatarInput.current?.click();
  };
  const onAvatarFile = (file: File | undefined) => {
    if (!file) return;
    if (!PROFILE_IMAGE_TYPES.includes(file.type)) { setMessage(t("profileImageInvalid")); return; }
    if (file.size > PROFILE_IMAGE_MAX_BYTES) { setMessage(t("profileImageTooLarge")); return; }
    const reader = new FileReader();
    reader.onerror = () => setMessage(t("profileImageReadError"));
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setAvatarDraft({ file, src: reader.result, name: file.name });
        setMessage(t("profileImageSelected", { name: file.name }));
      }
    };
    reader.readAsDataURL(file);
  };
  const confirmAvatar = () => {
    if (!avatarDraft) return;
    const uploadValue = usesApi ? avatarDraft.file : avatarDraft.src;
    Promise.resolve(repository.updateAvatar(uploadValue))
      .then(() => {
        setAvatarDraft(null);
        setMessage(t("avatarUpdated"));
      })
      .catch((reason) => setMessage(uiError(reason, t)));
  };
  const confirmLogout = () => {
    sessionStorage.setItem(LOGOUT_TOAST_KEY, "loggedOutToast");
    repository.logout();
    navigate("/login", { replace: true, state: { toastKey: "loggedOutToast" } });
  };
  const deleteAccount = () => {
    if (!confirm(t("deleteWarning"))) return;
    Promise.resolve(repository.deleteAccount())
      .then(() => navigate("/login"))
      .catch((reason) => setMessage(uiError(reason, t)));
  };

  return <div className="page settings-page">
    <header className="page-heading"><span className="eyebrow">{t("profile")}</span><h1>{t("settingsTitle")}</h1></header>
    {message && <div className="notice-line"><Check />{message}</div>}

    <section className="settings-section">
      <div className="settings-title"><SlidersHorizontal /><div><h2>{t("appearance")}</h2><p>{t("language")} · {t("theme")}</p></div></div>
      <div className="settings-controls">
        <label htmlFor="settings-language">{t("language")}<select id="settings-language" name="locale" value={user.locale} onChange={(event) => setLanguage(event.target.value as typeof user.locale)}>{locales.map((locale) => <option value={locale.value} key={locale.value}>{locale.label}</option>)}</select></label>
        <label htmlFor="settings-theme">{t("theme")}<select id="settings-theme" name="theme" value={user.theme} onChange={(event) => repository.updateSettings({ theme: event.target.value as typeof user.theme })}><option value="dark">{t("dark")}</option><option value="light">{t("light")}</option><option value="system">{t("system")}</option></select></label>
        <label htmlFor="settings-timezone">{t("timezone")}<select id="settings-timezone" name="timezone" value={user.timezone} onChange={(event) => repository.updateSettings({ timezone: event.target.value })}>{[user.timezone, "Asia/Tehran", "Europe/Berlin", "America/New_York", "Asia/Shanghai"].filter((value, index, list) => list.indexOf(value) === index).map((zone) => <option key={zone}>{zone}</option>)}</select></label>
      </div>
    </section>

    <section className="settings-section">
      <div className="settings-title"><Bell /><div><h2>{t("content")}</h2><p>{t("notificationMode")}</p></div></div>
      <div className="settings-controls">
        <label className="switch-row" htmlFor="settings-explicit"><span><strong>{t("explicitSetting")}</strong><small>{t("explicitMinor")}</small></span><input id="settings-explicit" name="explicitContentEnabled" type="checkbox" checked={user.explicitContentEnabled} onChange={(event) => repository.updateSettings({ explicitContentEnabled: event.target.checked })} /></label>
        <label htmlFor="settings-notifications">{t("notificationMode")}<select id="settings-notifications" name="notificationPreference" value={user.notificationPreference} onChange={(event) => repository.updateSettings({ notificationPreference: event.target.value as typeof user.notificationPreference })}><option value="all">{t("all")}</option><option value="important_only">{t("importantOnly")}</option><option value="max_five_daily">{t("maxFiveDaily")}</option><option value="muted">{t("muted")}</option></select></label>
      </div>
    </section>

    {user.kind === "consumer" && <>
      <section className="subscription-card">
        <div className={`plan-orb ${user.subscription.tier}`}><CircleDollarSign /></div>
        <div><span className="eyebrow">{t("currentPlan")}</span><h2>{t(user.subscription.tier)}</h2><p>{user.subscription.expiresAt ? new Intl.DateTimeFormat(user.locale, { dateStyle: "medium" }).format(new Date(user.subscription.expiresAt)) : t("basic")}</p></div>
        <button className="button primary" onClick={() => { setPlansOpen(true); setCheckoutMessage(""); }}><span>{t("upgrade")}</span><ChevronRight /></button>
      </section>

      <section className="settings-section payment-history">
        <div className="settings-title"><CircleDollarSign /><div><h2>{t("paymentHistory")}</h2><p>{t("paymentHistoryHelp")}</p></div></div>
        {userPayments.length ? <div className="payment-list">{userPayments.map((payment) => <article className="payment-row" key={payment.id}>
          <div><strong>{t(payment.tier)} · {payment.durationMonths} {t("monthShort")}</strong><span>{new Intl.DateTimeFormat(user.locale, { dateStyle: "medium" }).format(new Date(payment.createdAt))}</span></div>
          <div><span>{formatToman(payment.finalPriceRial)}</span><small>{t("paymentStatus")}: {t(`payment_${payment.status}`)}</small><small>{t("paymentProvider")}: {payment.provider}</small></div>
        </article>)}</div> : <p className="muted">{t("paymentHistoryEmpty")}</p>}
      </section>

      <div className="entitlement-grid">
        <button className={canEditAvatar(user.subscription.tier) ? "enabled" : "disabled"} onClick={chooseAvatar} aria-disabled={!canEditAvatar(user.subscription.tier)}><Image /><strong>{t("changeAvatar")}</strong><span>{canEditAvatar(user.subscription.tier) ? t("profileImageLocalHelp") : t("profileImageGate")}</span></button>
        <input ref={avatarInput} id="settings-avatar" name="avatar" className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => onAvatarFile(event.target.files?.[0])} />
        <div className={canDownload(user.subscription.tier) ? "enabled" : "disabled"}><Download /><strong>{t("download")}</strong><span>{t(canDownload(user.subscription.tier) ? "available" : "basic")}</span></div>
        <button className={canUseRooms(user.subscription.tier) ? "enabled" : "disabled"} disabled={!canUseRooms(user.subscription.tier)} onClick={() => navigate("/rooms")}><Users /><strong>{t("groupListening")}</strong><span>{t("roomsGate")}</span></button>
      </div>
    </>}

    <section className="settings-section danger-zone">
      <div className="settings-title"><MonitorSmartphone /><div><h2>{t("account")}</h2><p>{user.email}</p></div></div>
      <div className="settings-controls">
        {user.kind === "consumer" && <label htmlFor="settings-username">{t("username")}<div className="inline-control"><input id="settings-username" name="username" value={username} onChange={(event) => setUsername(event.target.value)} /><button className="button ghost" onClick={() => { try { repository.updateUsername(username); setMessage(t("done")); } catch (reason) { setMessage(uiError(reason, t)); } }}>{t("updateUsername")}</button></div><small>{t("usernameHelp")}</small></label>}
        <div className="account-logout-card"><div><strong>{t("logout")}</strong><span>{t("logoutSettingsHelp")}</span></div><button className="button ghost" onClick={() => setLogoutOpen(true)} aria-label={t("logoutSettingsLabel")}><LogOut />{t("logout")}</button></div>
        <div className="danger-actions">
          {!usesApi && <button className="button ghost" onClick={() => { if (confirm(t("resetDemoHelp"))) { repository.reset(); navigate("/login"); } }}><RotateCcw />{t("resetDemo")}</button>}
          <button className="button danger" onClick={deleteAccount}><Trash2 />{t("deleteAccount")}</button>
        </div>
      </div>
    </section>

    {avatarDraft && <div className="modal-backdrop"><div className="modal avatar-modal"><div className="modal-head"><div><span className="eyebrow">{t("profileImageTitle")}</span><h2>{t("profileImagePreview")}</h2></div><button className="icon-button" onClick={() => setAvatarDraft(null)} aria-label={t("close")}><X /></button></div><img className="avatar-preview" src={avatarDraft.src} alt={t("profileImagePreview")} /><p className="muted">{t("profileImageSelected", { name: avatarDraft.name })}</p><div className="modal-actions"><button className="button ghost" onClick={() => setAvatarDraft(null)}>{t("cancelProfileImage")}</button><button className="button primary" onClick={confirmAvatar}>{t("confirmProfileImage")}</button></div></div></div>}
    {logoutOpen && <div className="modal-backdrop"><div className="modal confirm-modal" role="dialog" aria-modal="true" aria-labelledby="settings-logout-title"><div className="modal-head"><div><span className="eyebrow">{t("account")}</span><h2 id="settings-logout-title">{t("logoutConfirmTitle")}</h2></div><button className="icon-button" onClick={() => setLogoutOpen(false)} aria-label={t("close")}><X /></button></div><p className="muted">{t("logoutConfirmBody")}</p><div className="modal-actions"><button className="button ghost" onClick={() => setLogoutOpen(false)}>{t("cancel")}</button><button className="button danger" onClick={confirmLogout}><LogOut />{t("logoutConfirmAction")}</button></div></div></div>}
    {plansOpen && <div className="modal-backdrop"><div className="modal plan-modal checkout-modal"><div className="modal-head"><div><span className="eyebrow">{t("demoSimulation")}</span><h2>{t("checkoutTitle")}</h2></div><button className="icon-button" onClick={() => setPlansOpen(false)} aria-label={t("close")}><X /></button></div><div className="checkout-layout"><section><h3>{t("checkoutStepChoose")}</h3><div className="plan-grid">{db.plans.filter((plan) => plan.isAvailable).map((plan) => <button className={`plan-choice ${plan.tier} ${checkoutPlan === plan.id ? "selected" : ""}`} key={plan.id} onClick={() => { setCheckoutPlan(plan.id); setCheckoutMessage(""); }}><span>{t(plan.tier)} · {plan.durationMonths} {t("monthShort")}</span><strong>{formatToman(plan.finalPriceRial)}</strong><small>{plan.discountPercent ? `${plan.discountPercent}% ${t("discount")}` : t("perMonth")}</small>{checkoutPlan === plan.id && <Check />}</button>)}</div></section><section className="checkout-review"><h3>{t("checkoutStepReview")}</h3>{selectedPlan ? <dl><div><dt>{t("planDetails")}</dt><dd>{t(selectedPlan.tier)} · {selectedPlan.durationMonths} {t("monthShort")}</dd></div><div><dt>{t("monthlyPrice")}</dt><dd>{formatToman(selectedPlan.monthlyPriceRial)}</dd></div><div><dt>{t("discount")}</dt><dd>{selectedPlan.discountPercent}%</dd></div><div><dt>{t("finalAmount")}</dt><dd>{formatToman(selectedPlan.finalPriceRial)}</dd></div><div><dt>{t("currentSubscription")}</dt><dd>{t(user.subscription.tier)}</dd></div></dl> : <p className="muted">{t("checkoutSelectPlan")}</p>}<div className={`checkout-consequence ${isBlocked(selectedPlan) ? "blocked" : user.subscription.tier === "silver" && selectedPlan?.tier === "gold" ? "warning" : ""}`}><LockKeyhole /><span>{consequence(selectedPlan)}</span></div><p className="muted">{t("noCreditPolicy")}</p>{checkoutMessage && <p className="form-error">{checkoutMessage}</p>}<div className="checkout-note"><LockKeyhole /><span>{t("checkoutSecurityNote")}</span></div><button className="button primary wide" onClick={purchase} disabled={!selectedPlan || Boolean(isBlocked(selectedPlan))}>{t("confirmDemoCheckout")}</button></section></div></div></div>}
  </div>;
}
