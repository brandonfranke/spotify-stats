import type {
  Album,
  Artist,
  Episode,
  Image,
  SimplifiedAlbum,
  SimplifiedArtist,
  SimplifiedTrack,
  Track,
} from "@spotify/web-api-ts-sdk";
import { cn } from "@spotify-stats/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { Disc3Icon, ExternalLinkIcon, Mic2Icon, MusicIcon } from "lucide-react";
import type { ReactNode } from "react";

import { formatDuration, formatReleaseDate, humanize, pickImage } from "@/lib/format";

/** Official Spotify icon, used unmodified for attribution and "Open Spotify" links. */
export function SpotifyIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={cn("size-4 shrink-0", className)}>
      <path
        fill="#1ED760"
        d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"
      />
    </svg>
  );
}

export function SpotifyLink({
  href,
  label = "Open Spotify",
  className,
}: {
  href: string | null | undefined;
  label?: string;
  className?: string;
}) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className={cn(
        "inline-flex min-h-9 items-center gap-2 border border-border px-3 text-sm font-medium text-foreground transition-colors hover:border-foreground/40 hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        className,
      )}
    >
      <SpotifyIcon />
      {label}
      <ExternalLinkIcon className="size-3.5 text-muted-foreground" aria-hidden="true" />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}

const placeholderIcons = { album: Disc3Icon, artist: Mic2Icon, track: MusicIcon };

/**
 * Cover art shown intact: never cropped, overlaid, filtered or animated.
 * Space is reserved up front so loading never shifts layout.
 */
export function Artwork({
  images,
  alt,
  size,
  kind = "album",
  className,
}: {
  images: Image[] | null | undefined;
  alt: string;
  size: number;
  kind?: keyof typeof placeholderIcons;
  className?: string;
}) {
  const image = pickImage(images, size * 2);
  const radius = size >= 160 ? "rounded-[var(--radius-artwork-lg)]" : "rounded-[var(--radius-artwork)]";
  if (!image) {
    const Icon = placeholderIcons[kind];
    return (
      <div
        role="img"
        aria-label={`${alt} (no artwork)`}
        style={{ width: size, height: size }}
        className={cn("grid shrink-0 place-items-center bg-muted text-faint-foreground", radius, className)}
      >
        <Icon className="size-1/3" aria-hidden="true" />
      </div>
    );
  }
  return (
    <img
      src={image.url}
      alt={alt}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      style={{ width: size, height: size }}
      className={cn("shrink-0 bg-muted object-contain", radius, className)}
    />
  );
}

export function ArtistLinks({ artists, className }: { artists: SimplifiedArtist[]; className?: string }) {
  return (
    <span className={cn("text-muted-foreground", className)}>
      {artists.map((artist, index) => (
        <span key={`${artist.id ?? artist.name}-${index}`}>
          {index > 0 && ", "}
          {artist.id ? (
            <Link
              to="/artists/$id"
              params={{ id: artist.id }}
              className="hover:text-foreground hover:underline"
            >
              {artist.name}
            </Link>
          ) : (
            artist.name
          )}
        </span>
      ))}
    </span>
  );
}

function ExplicitMark() {
  return (
    <span
      title="Explicit"
      className="inline-grid size-4 shrink-0 place-items-center bg-muted-foreground/80 text-[0.625rem] font-bold text-background"
    >
      E<span className="sr-only">xplicit</span>
    </span>
  );
}

/** Ordered list wrapper; preserves Spotify's returned order. */
export function MusicList({ children, start = 1 }: { children: ReactNode; start?: number }) {
  return (
    <ol start={start} className="divide-y divide-border border-y border-border">
      {children}
    </ol>
  );
}

function Rank({ value }: { value?: number }) {
  if (value === undefined) return null;
  return (
    <span className="tabular w-8 shrink-0 text-right font-display text-lg text-faint-foreground">
      {value}
    </span>
  );
}

export function TrackRow({
  track,
  rank,
  meta,
  compact,
}: {
  /** Album tracks are simplified (no album); playback can also be a podcast episode. */
  track: Track | SimplifiedTrack | Episode;
  rank?: number;
  /** Supplied context such as "played at" or "added on". */
  meta?: ReactNode;
  /** Narrow columns: drop the album column so title and artists get the room. */
  compact?: boolean;
}) {
  const album = "album" in track ? track.album : null;
  const isEpisode = "show" in track;
  return (
    <li className="group flex min-h-16 items-center gap-3 py-2 sm:gap-4">
      <Rank value={rank} />
      <Artwork images={album?.images ?? ("images" in track ? track.images : null)} alt="" size={48} kind="track" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {track.explicit && <ExplicitMark />}
          {!isEpisode && track.id ? (
            <Link
              to="/tracks/$id"
              params={{ id: track.id }}
              className="truncate font-medium text-foreground hover:underline"
            >
              {track.name}
            </Link>
          ) : (
            <span className="truncate font-medium">{track.name}</span>
          )}
        </div>
        <div className="truncate text-sm">
          {isEpisode ? (
            <span className="text-muted-foreground">Episode · {track.show?.name ?? "Podcast"}</span>
          ) : (
            <ArtistLinks artists={track.artists} />
          )}
        </div>
      </div>
      {album?.id && !compact && (
        <Link
          to="/albums/$id"
          params={{ id: album.id }}
          className="hidden w-48 truncate text-sm text-muted-foreground hover:text-foreground hover:underline lg:block"
        >
          {album.name}
        </Link>
      )}
      {meta && <div className="hidden text-right text-sm text-muted-foreground sm:block">{meta}</div>}
      <span className="tabular w-12 shrink-0 text-right text-sm text-muted-foreground">
        {formatDuration(track.duration_ms)}
      </span>
    </li>
  );
}

export function ArtistRow({ artist, rank }: { artist: Artist; rank?: number }) {
  return (
    <li className="flex min-h-16 items-center gap-3 py-2 sm:gap-4">
      <Rank value={rank} />
      <Artwork images={artist.images} alt="" size={48} kind="artist" className="rounded-full" />
      <div className="min-w-0 flex-1">
        {artist.id ? (
          <Link
            to="/artists/$id"
            params={{ id: artist.id }}
            className="truncate font-medium hover:underline"
          >
            {artist.name}
          </Link>
        ) : (
          <span className="font-medium">{artist.name}</span>
        )}
        {artist.genres && artist.genres.length > 0 && (
          <div className="truncate text-sm text-muted-foreground">{artist.genres.join(", ")}</div>
        )}
      </div>
    </li>
  );
}

export function AlbumCard({ album, meta }: { album: SimplifiedAlbum | Album; meta?: ReactNode }) {
  const title = album.id ? (
    <Link to="/albums/$id" params={{ id: album.id }} className="font-medium hover:underline">
      {album.name}
    </Link>
  ) : (
    <span className="font-medium">{album.name}</span>
  );
  return (
    <li className="flex flex-col gap-2">
      <Artwork images={album.images} alt={`Cover of ${album.name}`} size={160} className="w-full! h-auto! aspect-square" />
      <div className="min-w-0 text-sm">
        <div className="line-clamp-2">{title}</div>
        <div className="truncate text-muted-foreground">
          {[album.album_type && humanize(album.album_type), formatReleaseDate(album.release_date, "year")]
            .filter(Boolean)
            .join(" · ")}
        </div>
        {meta && <div className="text-faint-foreground">{meta}</div>}
      </div>
    </li>
  );
}

export function AlbumGrid({ children }: { children: ReactNode }) {
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {children}
    </ul>
  );
}
