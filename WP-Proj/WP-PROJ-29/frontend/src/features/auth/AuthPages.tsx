import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDown, Eye, EyeOff, Music2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { DEMO_PASSWORD } from "../../data/seed";
import type { Locale, RegistrationInput } from "../../domain/types";
import { locales } from "../../i18n";
import { RepositoryError, repository } from "../../repositories/localRepository";
import { Logo } from "../../components/Logo";

const demoUsers = [
  ["listener.basic@sonora.demo", "Nila · Basic"], ["listener.silver@sonora.demo", "Milo · Silver"], ["listener.gold@sonora.demo", "Ari · Gold"],
  ["artist.unverified@sonora.demo", "Cedar · Artist"], ["artist.verified@sonora.demo", "Nova · Verified"], ["support@sonora.demo", "Support"], ["admin@sonora.demo", "Admin"],
];

export function LoginPage() {
  const { t } = useTranslation(); const navigate = useNavigate(); const [showPassword, setShowPassword] = useState(false); const [demoOpen, setDemoOpen] = useState(false); const [error, setError] = useState("");
  const { register, handleSubmit, formState: { errors } } = useForm<{ email: string; password: string }>({ defaultValues: { email: "", password: "" } });
  const login = (email: string, password: string) => { try { repository.login(email, password); navigate("/"); } catch (reason) { setError(reason instanceof RepositoryError ? reason.message : t("error")); } };
  return <div className="auth-page"><div className="auth-brand"><Logo /><div className="auth-art"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="sound-core"><Music2 /></div></div><div><span className="eyebrow">SONORA</span><h1>{t("brandTagline")}</h1><p>{t("loginSubtitle")}</p></div></div><div className="auth-panel"><div className="auth-card"><h2>{t("welcomeBack")}</h2><p>{t("loginSubtitle")}</p><form onSubmit={handleSubmit((data) => login(data.email, data.password))}>
    <label>{t("email")}<input type="email" autoComplete="email" {...register("email", { required: t("required") })} /></label>{errors.email && <span className="field-error">{errors.email.message}</span>}
    <label>{t("password")}<span className="password-field"><input type={showPassword ? "text" : "password"} autoComplete="current-password" {...register("password", { required: t("required") })} /><button type="button" className="icon-button" onClick={() => setShowPassword(!showPassword)} aria-label={t("password")}>{showPassword ? <EyeOff /> : <Eye />}</button></span></label>{errors.password && <span className="field-error">{errors.password.message}</span>}
    {error && <div className="form-error" role="alert">{error}</div>}<div className="form-row"><Link to="/forgot-password">{t("forgotPassword")}</Link></div><button className="button primary wide" type="submit">{t("login")}</button>
  </form><button className="demo-toggle" onClick={() => setDemoOpen(!demoOpen)} aria-expanded={demoOpen}><span>{t("demoAccounts")}</span><ChevronDown className={demoOpen ? "rotated" : ""} /></button>{demoOpen && <div className="demo-list"><p>{t("demoPassword")}: <code>{DEMO_PASSWORD}</code></p>{demoUsers.map(([email, label]) => <button key={email} onClick={() => login(email, DEMO_PASSWORD)}><span>{label}</span><small>{email}</small></button>)}</div>}<p className="auth-switch">{t("noAccount")} <Link to="/register">{t("listenerRegister")}</Link> · <Link to="/register/artist">{t("artistAccount")}</Link></p></div></div></div>;
}

const schema = z.object({ displayName: z.string().min(2), stageName: z.string().optional(), email: z.email(), password: z.string().min(10), confirmPassword: z.string(), birthDate: z.string().min(1), gender: z.enum(["female", "male", "non_binary", "prefer_not_to_say"]), locale: z.enum(["en", "es", "de", "fr", "ru", "zh-CN"]), privacy: z.literal(true) }).refine((data) => data.password === data.confirmPassword, { path: ["confirmPassword"], message: "passwordsMismatch" });
type RegisterForm = z.infer<typeof schema>;

export function RegisterPage({ artist }: { artist: boolean }) {
  const { t, i18n } = useTranslation(); const navigate = useNavigate(); const [error, setError] = useState("");
  const browserLocale = locales.some((item) => item.value === navigator.language) ? navigator.language as Locale : "en";
  const { register, handleSubmit, formState: { errors } } = useForm<RegisterForm>({ resolver: zodResolver(schema), defaultValues: { displayName: "", stageName: "", email: "", password: "", confirmPassword: "", birthDate: "", gender: "prefer_not_to_say", locale: browserLocale, privacy: false as true } });
  const submit = (data: RegisterForm) => { if (artist && !data.stageName?.trim()) { setError(t("required")); return; } try { const input: RegistrationInput = { displayName: data.displayName, stageName: data.stageName, email: data.email, password: data.password, birthDate: data.birthDate, gender: data.gender, locale: data.locale, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }; repository.register(input, artist); void i18n.changeLanguage(data.locale); navigate("/"); } catch (reason) { setError(reason instanceof RepositoryError ? reason.message : t("error")); } };
  return <div className="register-page"><header><Logo /><Link to="/login">{t("login")}</Link></header><main><div className="register-intro"><span className="eyebrow">{artist ? t("artist") : t("consumer")}</span><h1>{t(artist ? "artistRegister" : "register")}</h1><p>{t("brandTagline")}</p></div><form className="register-card" onSubmit={handleSubmit(submit)}>
    <div className="form-grid"><label>{t("displayName")}<input {...register("displayName")} /></label>{artist && <label>{t("stageName")}<input {...register("stageName", { required: artist })} /></label>}<label>{t("email")}<input type="email" {...register("email")} /></label><label>{t("birthDate")}<input type="date" max={new Date().toISOString().slice(0, 10)} {...register("birthDate")} /></label><label>{t("gender")}<select {...register("gender")}><option value="female">{t("female")}</option><option value="male">{t("male")}</option><option value="non_binary">{t("nonBinary")}</option><option value="prefer_not_to_say">{t("preferNot")}</option></select></label><label>{t("language")}<select {...register("locale")}>{locales.map((locale) => <option key={locale.value} value={locale.value}>{locale.label}</option>)}</select></label><label>{t("password")}<input type="password" autoComplete="new-password" {...register("password")} /></label><label>{t("confirmPassword")}<input type="password" autoComplete="new-password" {...register("confirmPassword")} />{errors.confirmPassword && <span className="field-error">{t(errors.confirmPassword.message ?? "required")}</span>}</label></div>
    <label className="check-row"><input type="checkbox" {...register("privacy")} /><span>{t("privacyAccept")} <Link to="/privacy" target="_blank">{t("privacyPolicy")}</Link></span></label>{Object.keys(errors).length > 0 && <div className="form-error">{t("required")}</div>}{error && <div className="form-error">{error}</div>}<button className="button primary wide" type="submit">{t("createAccount")}</button><p>{t("accountExists")} <Link to="/login">{t("login")}</Link></p>
  </form></main></div>;
}

export function ForgotPasswordPage() { const { t } = useTranslation(); return <div className="simple-public"><Logo /><div className="public-card"><h1>{t("resetTitle")}</h1><p>{t("resetHelp")}</p><Link className="button primary" to="/login">{t("backToLogin")}</Link></div></div>; }
export function PrivacyPage() { const { t } = useTranslation(); return <div className="simple-public privacy-copy"><Logo /><article className="public-card"><span className="eyebrow">SONORA</span><h1>{t("privacyPolicy")}</h1><p>{t("privacyLocal")}</p><p>{t("privacyServer")}</p><p>{t("privacyStaff")}</p></article></div>; }
