import { ArrowRight, Flame, Headphones, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { CoverArt } from "../../components/CoverArt";
import { MediaCard } from "../../components/MediaCard";
import { Section } from "../../components/Section";
import { TrackRow } from "../../components/TrackRow";
import { repository } from "../../repositories/localRepository";
import { usePlayer } from "../../store/player";
import { useDatabaseVersion, useSession } from "../../store/session";

export function HomePage() {
  const { t } = useTranslation(); const user = useSession()!; useDatabaseVersion(); const db = repository.database(); const tracks = repository.tracks(); const replace = usePlayer((s) => s.replaceContext);
  const hour = new Date().getHours(); const greeting = hour < 12 ? "greetingMorning" : hour < 18 ? "greetingAfternoon" : "greetingEvening";
  const recent = user.recentlyPlayedIds.map((id) => tracks.find((track) => track.id === id)).filter(Boolean) as typeof tracks;
  const published = db.releases.filter((release) => release.status === "published").sort((a, b) => b.publicReleaseAt.localeCompare(a.publicReleaseAt));
  const popular = [...tracks].sort((a, b) => b.uniqueListenerCount - a.uniqueListenerCount).slice(0, 5);
  const early = db.releases.filter((release) => release.isEarlyAccess);
  const followed = published.filter((release) => user.followingIds.includes(release.ownerUserId));
  return <div className="page home-page">
    <header className="home-hero"><div><span className="eyebrow">{t(greeting)}</span><h1>{user.displayName}</h1><p>{t("brandTagline")}</p></div>{user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : <div className="avatar-fallback">{user.displayName.slice(0, 1)}</div>}</header>
    <div className="insight-grid"><div className="insight primary"><div><span>{t("weeklySound")}</span><strong>186</strong><small>{t("minutesListened")}</small></div><div className="mini-bars">{[44, 71, 36, 82, 54, 94, 63].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}</div></div><div className="insight"><span className="insight-icon"><Flame /></span><div><strong>8</strong><small>{t("listeningStreak")}</small></div></div><div className="insight"><span className="insight-icon violet"><Headphones /></span><div><strong>Electronic</strong><small>{t("topMood")}</small></div></div></div>
    {recent.length > 0 && <Section title={t("recentlyPlayed")}><div className="quick-grid">{recent.slice(0, 6).map((track, index) => <button key={`${track.id}-${index}`} onClick={() => replace(recent, track.id)} disabled={!track.isPlayableForViewer}><CoverArt src={track.coverUrl} alt="" /><span><strong>{track.title}</strong><small>{track.artists[0].stageName}</small></span><ArrowRight /></button>)}</div></Section>}
    {followed.length > 0 && <Section title={t("followedRelease")}><div className="media-grid">{followed.map((release) => { const releaseTracks = tracks.filter((track) => release.trackIds.includes(track.id)); return <MediaCard key={release.id} title={release.title} subtitle={release.primaryArtist.stageName} coverUrl={release.coverUrl} href={`/release/${release.id}`} badge="new" onPlay={() => replace(releaseTracks, release.trackIds[0])} />; })}</div></Section>}
    <Section title={t("newReleases")} action={<Link to="/search" className="text-link">{t("search")} <ArrowRight /></Link>}><div className="media-grid">{published.slice(0, 5).map((release) => { const releaseTracks = tracks.filter((track) => release.trackIds.includes(track.id)); return <MediaCard key={release.id} title={release.title} subtitle={release.primaryArtist.stageName} coverUrl={release.coverUrl} href={`/release/${release.id}`} onPlay={() => replace(releaseTracks, release.trackIds[0])} />; })}</div></Section>
    {user.subscription.tier === "gold" && early.length > 0 && <Section title={t("earlyAccess")}><div className="early-banner"><div><span className="eyebrow"><Sparkles /> {t("gold")}</span><h3>{early[0].title}</h3><p>{early[0].primaryArtist.stageName} · {new Intl.DateTimeFormat(user.locale, { dateStyle: "long" }).format(new Date(early[0].publicReleaseAt))}</p><Link className="button gold" to={`/release/${early[0].id}`}>{t("play")}</Link></div><CoverArt src={early[0].coverUrl} alt={early[0].title} /></div></Section>}
    <Section title={t("popularTracks")}><div className="track-list">{popular.map((track, index) => <TrackRow key={track.id} track={track} context={popular} index={index} />)}</div></Section>
  </div>;
}
