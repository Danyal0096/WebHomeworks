import { Bell, CheckCheck, Circle, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "../../components/EmptyState";
import { repository } from "../../repositories/localRepository";
import { useDatabaseVersion, useSession } from "../../store/session";

export function NotificationsPage() {
  const { t } = useTranslation(); const user = useSession()!; useDatabaseVersion(); const notices = repository.notifications();
  const text = (key: string | undefined, fallback: string, values?: Record<string, string | number>) => key ? t(key, values) : fallback;
  return <div className="page narrow-page"><header className="page-heading with-action"><div><span className="eyebrow">{t("notifications")}</span><h1>{t("notificationTitle")}</h1></div>{notices.some((notice) => !notice.readAt) && <button className="button ghost" onClick={() => repository.readAllNotifications()}><CheckCheck />{t("markAllRead")}</button>}</header>{notices.length ? <div className="notification-list">{notices.map((notice) => <article key={notice.id} className={`notification-card ${!notice.readAt ? "unread" : ""}`}><span className={`notice-dot ${notice.kind}`}><Bell /></span><div><div className="notification-meta"><span>{t(notice.readAt ? "read" : "unread")}</span><time>{new Intl.DateTimeFormat(user.locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(notice.createdAt))}</time></div><h2>{text(notice.titleKey, notice.title, notice.values)}</h2><p>{text(notice.bodyKey, notice.body, notice.values)}</p></div><div className="notice-actions">{!notice.readAt && <button className="icon-button" onClick={() => repository.readNotification(notice.id)} aria-label={t("read")}><Circle /></button>}<button className="icon-button danger" onClick={() => repository.deleteNotification(notice.id)} aria-label={t("remove")}><Trash2 /></button></div></article>)}</div> : <EmptyState icon={Bell} title={t("notificationEmpty")} body={t("notificationEmptyBody")} />}</div>;
}
