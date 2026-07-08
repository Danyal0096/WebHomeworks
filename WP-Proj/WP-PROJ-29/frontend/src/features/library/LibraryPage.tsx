import { ArrowLeft, Clock3, Heart, LibraryBig, Play, Plus, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";
import { EmptyState } from "../../components/EmptyState";
import { MediaCard } from "../../components/MediaCard";
import { Section } from "../../components/Section";
import { TrackRow } from "../../components/TrackRow";
import { repository } from "../../repositories/localRepository";
import { usePlayer } from "../../store/player";
import { useDatabaseVersion, useSession } from "../../store/session";
import { uiError } from "../shared/errors";

export function LibraryPage() {
  const { t } = useTranslation(); const navigate = useNavigate(); const { view } = useParams(); const user = useSession()!; useDatabaseVersion(); const db = repository.database(); const { owned, saved, liked } = repository.library(); const tracks = repository.tracks(); const replace = usePlayer((state) => state.replaceContext); const [creating, setCreating] = useState(false); const [title, setTitle] = useState(""); const [error, setError] = useState("");
  const recent = user.recentlyPlayedIds.map((id) => tracks.find((track) => track.id === id)).filter(Boolean) as typeof tracks;
  const create = () => {
    Promise.resolve(repository.createPlaylist(title || t("playlistName"))).then((playlist) => { setCreating(false); setTitle(""); navigate(`/playlist/${playlist.id}`); }).catch((reason) => setError(uiError(reason, t)));
  };
  const viewName = view === "liked" || view === "history" ? view : "overview";
  const focusedTracks = viewName === "liked" ? liked : recent;
  if (viewName !== "overview") return <div className="page"><header className="page-heading with-action"><div><Link to="/library" className="text-link"><ArrowLeft />{t("backToLibrary")}</Link><span className="eyebrow">{t("library")}</span><h1>{t(viewName === "liked" ? "likedSongsView" : "historyView")}</h1><p className="muted">{t(viewName === "liked" ? "privateBoundary" : "recentlyPlayed")}</p></div><button className="button primary" onClick={() => focusedTracks[0] && replace(focusedTracks, focusedTracks[0].id)} disabled={!focusedTracks.some((track) => track.isPlayableForViewer)}><Play />{t("playAll")}</button></header><div className="track-list">{focusedTracks.length ? focusedTracks.map((track, index) => <TrackRow key={`${track.id}-${index}`} track={track} context={focusedTracks} index={index} />) : <EmptyState icon={viewName === "liked" ? Heart : Clock3} title={t(viewName === "liked" ? "likedEmpty" : "historyEmpty")} body={t(viewName === "liked" ? "likedEmptyBody" : "historyEmptyBody")} />}</div></div>;
  return <div className="page"><header className="page-heading with-action"><div><span className="eyebrow">{t("library")}</span><h1>{t("yourLibrary")}</h1></div><button className="button primary" onClick={() => setCreating(true)}><Plus />{t("createPlaylist")}</button></header>
    <div className="library-feature-grid"><Link to="/library/liked" className="library-feature liked"><Heart fill="currentColor" /><div><h2>{t("likedSongs")}</h2><span>{t("tracksCount", { count: liked.length })}</span></div></Link><Link to="/library/history" className="library-feature history"><Clock3 /><div><h2>{t("recentHistory")}</h2><span>{t("tracksCount", { count: recent.length })}</span></div></Link></div>
    <Section title={t("ownedPlaylists")}><div className="media-grid">{owned.map((playlist) => <MediaCard key={playlist.id} title={playlist.title} subtitle={`${t(playlist.visibility)} · ${t("tracksCount", { count: playlist.trackIds.length })}`} collageUrls={playlist.trackIds.map((id) => db.tracks.find((track) => track.id === id)?.coverUrl ?? null)} href={`/playlist/${playlist.id}`} />)}<button className="create-card" onClick={() => setCreating(true)}><span><Plus /></span><strong>{t("createPlaylist")}</strong></button></div></Section>
    <Section title={t("savedPlaylists")}>{saved.length ? <div className="media-grid">{saved.map((playlist) => <MediaCard key={playlist.id} title={playlist.title} subtitle={t("liveReference")} collageUrls={playlist.trackIds.map((id) => db.tracks.find((track) => track.id === id)?.coverUrl ?? null)} href={`/playlist/${playlist.id}`} />)}</div> : <EmptyState icon={LibraryBig} title={t("savedPlaylists")} body={t("noPublicPlaylists")} />}</Section>
    <Section title={t("likedSongs")}><div id="liked" className="track-list">{liked.length ? liked.map((track, index) => <TrackRow key={track.id} track={track} context={liked} index={index} compact />) : <EmptyState icon={Heart} title={t("likedEmpty")} body={t("likedEmptyBody")} />}</div></Section>
    <Section title={t("recentHistory")}><div id="history" className="track-list">{recent.length ? recent.map((track, index) => <TrackRow key={`${track.id}-${index}`} track={track} context={recent} index={index} compact />) : <EmptyState icon={Clock3} title={t("historyEmpty")} body={t("historyEmptyBody")} />}</div></Section>
    {creating && <div className="modal-backdrop"><div className="modal"><div className="modal-head"><h2>{t("createPlaylist")}</h2><button className="icon-button" onClick={() => setCreating(false)}><X /></button></div><label htmlFor="playlist-title">{t("playlistName")}<input id="playlist-title" name="playlistTitle" autoFocus value={title} onChange={(event) => setTitle(event.target.value)} onKeyDown={(event) => event.key === "Enter" && create()} /></label>{error && <p className="form-error">{error}</p>}<div className="modal-actions"><button className="button ghost" onClick={() => setCreating(false)}>{t("cancel")}</button><button className="button primary" onClick={create}>{t("create")}</button></div></div></div>}
  </div>;
}
