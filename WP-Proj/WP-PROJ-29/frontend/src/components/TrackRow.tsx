import { Download, Ellipsis, Heart, ListEnd, ListPlus, LockKeyhole, Play } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import type { TrackView } from "../domain/types";
import { repository } from "../repositories/localRepository";
import { usePlayer } from "../store/player";
import { CoverArt } from "./CoverArt";
import { useSession } from "../store/session";
import { canDownload } from "../domain/entitlements";

export function TrackRow({ track, context, index, compact = false }: { track: TrackView; context: TrackView[]; index?: number; compact?: boolean }) {
  const { t } = useTranslation(); const [menu, setMenu] = useState(false);
  const user = useSession();
  const replace = usePlayer((s) => s.replaceContext); const addNext = usePlayer((s) => s.addNext); const addToQueue = usePlayer((s) => s.addToQueue);
  const lockText = track.lockReason === "gold_required" ? t("goldRequired") : track.lockReason === "explicit_restricted" ? t("explicitRestricted") : t("dailyLimit");
  return <div className={`track-row ${compact ? "compact" : ""} ${!track.isPlayableForViewer ? "is-locked" : ""}`}>
    <button className="track-play" onClick={() => replace(context, track.id)} disabled={!track.isPlayableForViewer} aria-label={track.isPlayableForViewer ? `${t("play")} ${track.title}` : lockText}>{track.isPlayableForViewer ? <>{index !== undefined && <span className="track-index">{index + 1}</span>}<Play className="track-play-icon" fill="currentColor" /></> : <LockKeyhole />}</button>
    <CoverArt src={track.coverUrl} alt="" />
    <div className="track-main"><strong>{track.title} {track.isExplicit && <span className="explicit-mark" title={t("explicit")}>E</span>}</strong><Link to={`/artist/${track.artists[0].username}`}>{track.artists.map((a) => a.stageName).join(", ")}</Link></div>
    {!compact && <Link className="track-release" to={`/release/${track.releaseId}`}>{track.releaseTitle}</Link>}
    {!track.isPlayableForViewer && <span className="lock-label">{lockText}</span>}
    <span className="track-duration">{Math.floor(track.durationSeconds / 60)}:{String(track.durationSeconds % 60).padStart(2, "0")}</span>
    <button className={`icon-button ${track.isLiked ? "active" : ""}`} onClick={() => repository.like(track.id)} aria-label={t(track.isLiked ? "unlike" : "like")}><Heart fill={track.isLiked ? "currentColor" : "none"} /></button>
    <div className="menu-wrap"><button className="icon-button" aria-label={t("more")} onClick={() => setMenu(!menu)}><Ellipsis /></button>{menu && <div className="popover-menu"><button onClick={() => { addNext(track.id); setMenu(false); }}><ListEnd />{t("addNext")}</button><button onClick={() => { addToQueue(track.id); setMenu(false); }}><ListPlus />{t("addQueue")}</button>{user && canDownload(user.subscription.tier) && <a href={track.audioUrl} download={`${track.title}.wav`} onClick={() => setMenu(false)}><Download />{t("download")}</a>}</div>}</div>
  </div>;
}
