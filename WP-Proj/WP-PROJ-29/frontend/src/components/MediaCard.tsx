import { LockKeyhole, Play, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CoverArt, PlaylistCollage } from "./CoverArt";

interface MediaCardProps {
  title: string;
  subtitle: string;
  coverUrl?: string | null;
  collageUrls?: (string | null)[];
  href: string;
  onPlay?: () => void;
  locked?: boolean;
  badge?: "new" | "gold";
}

export function MediaCard({ title, subtitle, coverUrl = null, collageUrls, href, onPlay, locked, badge }: MediaCardProps) {
  const { t } = useTranslation();
  return <article className="media-card">
    <Link to={href} className="media-art">
      {collageUrls ? <PlaylistCollage urls={collageUrls} title={title} /> : <CoverArt src={coverUrl} alt={title} />}
      {badge && <span className={`media-badge ${badge}`}><Sparkles size={12} />{badge === "gold" ? t("gold") : t("newBadge")}</span>}
    </Link>
    <div className="media-copy"><Link to={href} className="media-title">{title}</Link><span>{subtitle}</span></div>
    {onPlay && <button className="floating-play" onClick={onPlay} aria-label={`${t("play")} ${title}`} disabled={locked}>{locked ? <LockKeyhole /> : <Play fill="currentColor" />}</button>}
  </article>;
}
