import { BadgeCheck, BarChart3, Headphones, LockKeyhole, UserPlus, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { EmptyState } from "../../components/EmptyState";
import { MediaCard } from "../../components/MediaCard";
import { Section } from "../../components/Section";
import { repository } from "../../repositories/localRepository";
import { useDatabaseVersion, useSession } from "../../store/session";

export function ProfilePage({ artistRoute = false }: { artistRoute?: boolean }) {
  const { username = "" } = useParams(); const { t } = useTranslation(); const me = useSession()!; useDatabaseVersion(); const result = repository.profile(username); const db = repository.database();
  if (!result || (artistRoute && !result.user.artistProfile)) return <div className="page"><EmptyState icon={LockKeyhole} title={t("notFound")} body={t("forbidden")} /></div>;
  const { user, profile, playlists } = result; const artist = user.artistProfile; const releases = artist ? db.releases.filter((release) => release.ownerUserId === user.id && release.status === "published") : []; const own = user.id === me.id;
  return <div className="page profile-page"><header className={`profile-hero ${artist ? "artist" : ""}`}><div className="profile-backdrop" />{user.avatarUrl ? <img className="profile-avatar" src={user.avatarUrl} alt="" /> : <div className="profile-avatar fallback">{profile.displayName.slice(0, 1)}</div>}<div className="profile-copy"><span className="eyebrow">{t(artist ? "artist" : "profile")}</span><h1>{profile.displayName}{artist?.verifiedAt && <BadgeCheck aria-label={t("verified")} />}</h1><span>@{profile.username}</span>{artist && <p>{artist.bio}</p>}<div className="profile-stats"><span><strong>{profile.followerCount}</strong> {t("followers")}</span><span><strong>{profile.followingCount}</strong> {t("following")}</span></div></div>{!own && <button className={`button ${profile.isFollowing ? "ghost" : "primary"}`} onClick={() => repository.follow(user.id)}><UserPlus />{t(profile.isFollowing ? "unfollow" : "follow")}</button>}</header>
    {!artist && <p className="privacy-note"><LockKeyhole />{t("privateBoundary")}</p>}
    {artist && me.subscription.tier === "gold" && <div className="metrics-grid"><div><Users /><strong>{user.followerIds.length * 2860 + 12400}</strong><span>{t("listeners")}</span></div><div><Headphones /><strong>{releases.reduce((sum, release) => sum + release.trackIds.reduce((n, id) => n + (db.tracks.find((track) => track.id === id)?.streamCount ?? 0), 0), 0).toLocaleString()}</strong><span>{t("streams")}</span></div><div><BarChart3 /><strong>+18%</strong><span>{t("artistMetrics")}</span></div></div>}
    {artist && <Section title={t("releases")}>{releases.length ? <div className="media-grid">{releases.map((release) => <MediaCard key={release.id} title={release.title} subtitle={`${t(release.type)} · ${release.genre}`} coverUrl={release.coverUrl} href={`/release/${release.id}`} />)}</div> : <EmptyState icon={Headphones} title={t("noPublishedCatalog")} body={t("verificationJourney")} />}</Section>}
    <Section title={t("publicPlaylists")}>{playlists.length ? <div className="media-grid">{playlists.map((playlist) => <MediaCard key={playlist.id} title={playlist.title} subtitle={t("tracksCount", { count: playlist.trackIds.length })} collageUrls={playlist.trackIds.map((id) => db.tracks.find((track) => track.id === id)?.coverUrl ?? null)} href={`/playlist/${playlist.id}`} />)}</div> : <EmptyState icon={Headphones} title={t("noPublicPlaylists")} body={t("privateBoundary")} />}</Section>
  </div>;
}
