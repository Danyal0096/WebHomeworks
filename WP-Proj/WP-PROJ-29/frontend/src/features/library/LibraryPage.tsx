import { Clock3, Heart, LibraryBig, Plus, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { CoverArt } from "../../components/CoverArt";
import { EmptyState } from "../../components/EmptyState";
import { MediaCard } from "../../components/MediaCard";
import { Section } from "../../components/Section";
import { TrackRow } from "../../components/TrackRow";
import { RepositoryError, repository } from "../../repositories/localRepository";
import { useDatabaseVersion, useSession } from "../../store/session";

export function LibraryPage() {
  const { t } = useTranslation(); const navigate = useNavigate(); const user = useSession()!; useDatabaseVersion(); const db = repository.database(); const { owned, saved, liked } = repository.library(); const tracks = repository.tracks(); const [creating, setCreating] = useState(false); const [title, setTitle] = useState(""); const [error, setError] = useState("");
  const recent = user.recentlyPlayedIds.map((id) => tracks.find((track) => track.id === id)).filter(Boolean) as typeof tracks;
  const create = () => { try { const playlist = repository.createPlaylist(title || t("playlistName")); setCreating(false); setTitle(""); navigate(`/playlist/${playlist.id}`); } catch (reason) { setError(reason instanceof RepositoryError ? reason.message : t("error")); } };
  return <div className="page"><header className="page-heading with-action"><div><span className="eyebrow">{t("library")}</span><h1>{t("yourLibrary")}</h1></div><button className="button primary" onClick={() => setCreating(true)}><Plus />{t("createPlaylist")}</button></header>
    <div className="library-feature-grid"><Link to="/library#liked" className="library-feature liked"><Heart fill="currentColor" /><div><h2>{t("likedSongs")}</h2><span>{t("tracksCount", { count: liked.length })}</span></div></Link><Link to="/library#history" className="library-feature history"><Clock3 /><div><h2>{t("recentHistory")}</h2><span>{t("tracksCount", { count: recent.length })}</span></div></Link></div>
    <Section title={t("ownedPlaylists")}><div className="media-grid">{owned.map((playlist) => <MediaCard key={playlist.id} title={playlist.title} subtitle={`${t(playlist.visibility)} · ${t("tracksCount", { count: playlist.trackIds.length })}`} collageUrls={playlist.trackIds.map((id) => db.tracks.find((track) => track.id === id)?.coverUrl ?? null)} href={`/playlist/${playlist.id}`} />)}<button className="create-card" onClick={() => setCreating(true)}><span><Plus /></span><strong>{t("createPlaylist")}</strong></button></div></Section>
    <Section title={t("savedPlaylists")}>{saved.length ? <div className="media-grid">{saved.map((playlist) => <MediaCard key={playlist.id} title={playlist.title} subtitle={t("liveReference")} collageUrls={playlist.trackIds.map((id) => db.tracks.find((track) => track.id === id)?.coverUrl ?? null)} href={`/playlist/${playlist.id}`} />)}</div> : <EmptyState icon={LibraryBig} title={t("savedPlaylists")} body={t("noPublicPlaylists")} />}</Section>
    <Section title={t("likedSongs")}><div id="liked" className="track-list">{liked.length ? liked.map((track, index) => <TrackRow key={track.id} track={track} context={liked} index={index} />) : <EmptyState icon={Heart} title={t("likedSongs")} body={t("playlistEmptyBody")} />}</div></Section>
    <Section title={t("recentHistory")}><div id="history" className="quick-grid">{recent.map((track) => <Link to={`/release/${track.releaseId}`} key={track.id}><CoverArt src={track.coverUrl} alt="" /><span><strong>{track.title}</strong><small>{track.artists[0].stageName}</small></span></Link>)}</div></Section>
    {creating && <div className="modal-backdrop"><div className="modal"><div className="modal-head"><h2>{t("createPlaylist")}</h2><button className="icon-button" onClick={() => setCreating(false)}><X /></button></div><label>{t("playlistName")}<input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} onKeyDown={(event) => event.key === "Enter" && create()} /></label>{error && <p className="form-error">{error}</p>}<div className="modal-actions"><button className="button ghost" onClick={() => setCreating(false)}>{t("cancel")}</button><button className="button primary" onClick={create}>{t("create")}</button></div></div></div>}
  </div>;
}
