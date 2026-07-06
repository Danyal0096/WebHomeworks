import { Check, LockKeyhole, MessageCircle, Plus, TicketCheck } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "../../components/EmptyState";
import { canOpenTicket } from "../../domain/entitlements";
import { repository } from "../../repositories/localRepository";
import { useDatabaseVersion, useSession } from "../../store/session";

export function TicketsPage() {
  const { t } = useTranslation(); const me = useSession()!; useDatabaseVersion(); const tickets = repository.tickets(); const db = repository.database(); const [subject, setSubject] = useState(""); const [body, setBody] = useState(""); const [reply, setReply] = useState<Record<string, string>>({}); const eligible = canOpenTicket(me);
  return <div className="page narrow-page"><header className="page-heading"><span className="eyebrow">{t("support")}</span><h1>{t("tickets")}</h1></header>{eligible ? <div className="new-ticket-card"><h2>{t("newTicket")}</h2><label>{t("ticketSubject")}<input value={subject} onChange={(e) => setSubject(e.target.value)} /></label><label>{t("note")}<textarea value={body} onChange={(e) => setBody(e.target.value)} /></label><button className="button primary" onClick={() => { if (subject && body) { repository.createTicket(subject, body); setSubject(""); setBody(""); } }}><Plus />{t("newTicket")}</button></div> : <div className="locked-card"><LockKeyhole /><div><h2>{t("ticketGate")}</h2><p>{t("currentPlan")}: {t(me.subscription.tier)}</p></div></div>}
    <div className="consumer-tickets">{tickets.length ? tickets.map((ticket) => <article key={ticket.id}><header><TicketCheck /><div><h2>{ticket.subject}</h2><span>{t(ticket.status)} · {new Date(ticket.createdAt).toLocaleDateString()}</span></div>{ticket.status !== "closed" && <button className="button ghost" onClick={() => repository.closeTicket(ticket.id)}><Check />{t("close")}</button>}</header><div className="messages">{ticket.messages.map((message) => <div className={`message ${message.authorId === me.id ? "own" : ""}`} key={message.id}><span>{db.users.find((user) => user.id === message.authorId)?.displayName}</span><p>{message.body}</p></div>)}</div>{ticket.status !== "closed" && <div className="message-compose"><input value={reply[ticket.id] ?? ""} onChange={(e) => setReply({ ...reply, [ticket.id]: e.target.value })} /><button className="button small" onClick={() => { if (reply[ticket.id]) { repository.replyTicket(ticket.id, reply[ticket.id]); setReply({ ...reply, [ticket.id]: "" }); } }}><MessageCircle />{t("send")}</button></div>}</article>) : <EmptyState icon={TicketCheck} title={t("noTickets")} body={t("notificationEmptyBody")} />}</div>
  </div>;
}
