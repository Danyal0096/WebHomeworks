import { BadgeCheck, Search as SearchIcon, UserRound } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { MediaCard } from "../../components/MediaCard";
import { Section } from "../../components/Section";
import { TrackRow } from "../../components/TrackRow";
import { repository } from "../../repositories/localRepository";
import { useDatabaseVersion } from "../../store/session";

export function SearchPage() {
  const { t } = useTranslation(); useDatabaseVersion(); const db = repository.database(); const allTracks = repository.tracks(); const [query, setQuery] = useState(""); const [sort, setSort] = useState<"popular" | "newest">("popular"); const [genre, setGenre] = useState("all");
  const needle = query.toLowerCase().trim(); const includes = (value: string) => !needle || value.toLowerCase().includes(needle);
  const genres = [...new Set(allTracks.map((track) => track.genre))];
  const tracks = allTracks.filter((track) => (includes(track.title) || includes(track.artists.map((a) => a.stageName).join(" ")) || includes(track.genre)) && (genre === "all" || track.genre === genre)).sort((a, b) => sort === "popular" ? b.uniqueListenerCount - a.uniqueListenerCount : b.publicReleaseAt.localeCompare(a.publicReleaseAt));
  const releases = db.releases.filter((release) => release.status !== "archived" && (includes(release.title) || includes(release.primaryArtist.stageName)));
  const profiles = db.users.filter((user) => user.kind === "consumer" && !user.deletedAt && (includes(user.displayName) || includes(user.username) || includes(user.artistProfile?.stageName ?? "")));
  const playlists = db.playlists.filter((playlist) => playlist.visibility === "public" && includes(playlist.title));
  const hasResults = tracks.length || releases.length || profiles.length || playlists.length;
  return <div className="page search-page"><header className="page-heading"><span className="eyebrow">{t("search")}</span><h1>{t("searchTitle")}</h1></header><div className="search-box"><SearchIcon /><input id="search-query" name="query" autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("searchPlaceholder")} /></div><div className="filter-row"><select id="search-sort" name="sort" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label={t("search")}><option value="popular">{t("sortPopular")}</option><option value="newest">{t("sortNewest")}</option></select><select id="search-genre" name="genre" value={genre} onChange={(e) => setGenre(e.target.value)} aria-label={t("genre")}><option value="all">{t("allGenres")}</option>{genres.map((item) => <option key={item}>{item}</option>)}</select></div>
    {!hasResults && <div className="empty-state"><SearchIcon /><h2>{t("noResults")}</h2><p>{t("noResultsBody")}</p></div>}
    {profiles.length > 0 && <Section title={t("people")}><div className="profile-grid">{profiles.slice(0, 6).map((profile) => <Link to={profile.artistProfile ? `/artist/${profile.username}` : `/profile/${profile.username}`} className="profile-card" key={profile.id}>{profile.avatarUrl ? <img src={profile.avatarUrl} alt="" /> : <span><UserRound /></span>}<strong>{profile.artistProfile?.stageName ?? profile.displayName}{profile.artistProfile?.verifiedAt && <BadgeCheck />}</strong><small>@{profile.username} · {t(profile.artistProfile ? "artist" : "consumer")}</small></Link>)}</div></Section>}
    {tracks.length > 0 && <Section title={t("tracks")}><div className="track-list">{tracks.slice(0, 8).map((track, index) => <TrackRow key={track.id} track={track} context={tracks} index={index} />)}</div></Section>}
    {releases.length > 0 && <Section title={t("releases")}><div className="media-grid">{releases.map((release) => <MediaCard key={release.id} title={release.title} subtitle={`${t(release.type)} · ${release.primaryArtist.stageName}`} coverUrl={release.coverUrl} href={`/release/${release.id}`} />)}</div></Section>}
    {playlists.length > 0 && <Section title={t("playlists")}><div className="media-grid">{playlists.map((playlist) => <MediaCard key={playlist.id} title={playlist.title} subtitle={t("tracksCount", { count: playlist.trackIds.length })} collageUrls={playlist.trackIds.map((id) => db.tracks.find((track) => track.id === id)?.coverUrl ?? null)} href={`/playlist/${playlist.id}`} />)}</div></Section>}
  </div>;
}
