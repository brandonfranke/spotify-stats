import type { Sound } from "@spotify-stats/api/sound";
import { TRAITS } from "@spotify-stats/api/sound";
import { useQuery } from "@tanstack/react-query";

import { EmptyNote, ErrorNotice, RowsSkeleton, Section } from "@/components/editorial";
import { formatKey } from "@/lib/format";
import { orpc } from "@/utils/orpc";

const traitCopy: Record<(typeof TRAITS)[number], string> = {
  energy: "Intensity and activity",
  danceability: "Suited to dancing",
  valence: "Musical positivity",
  acousticness: "Acoustic, not electronic",
  instrumentalness: "Lack of vocals",
  speechiness: "Spoken words",
  liveness: "Live audience",
};

/** Section 03 of the track page: tempo, key and audio traits from outside Spotify. */
export function SoundSection({ id, isrc }: { id: string; isrc?: string }) {
  const sound = useQuery(orpc.spotify.sound.queryOptions({ input: { id, isrc }, staleTime: Infinity }));

  return (
    <Section number="03" title="Sound">
      {sound.isPending ? (
        <RowsSkeleton rows={3} />
      ) : sound.isError ? (
        <ErrorNotice error={sound.error} onRetry={() => sound.refetch()} />
      ) : (
        <SoundReadout sound={sound.data} />
      )}
    </Section>
  );
}

export function SoundReadout({ sound }: { sound: Sound | null }) {
  if (!sound) {
    return <EmptyNote>Neither ReccoBeats nor Deezer has sound data for this track yet.</EmptyNote>;
  }
  const traits = TRAITS.filter((trait) => sound.traits[trait] != null);

  return (
    <div className="flex flex-col gap-6">
      <dl className="grid grid-cols-3 border-y border-border">
        <Reading label="Tempo" value={sound.tempo ? Math.round(sound.tempo) : null} unit="BPM" large />
        <Reading label="Key" value={formatKey(sound.key, sound.mode)} />
        <Reading
          label="Loudness"
          value={sound.loudness != null ? sound.loudness.toFixed(1) : null}
          unit="dB"
        />
      </dl>

      {traits.length > 0 && (
        <ul className="flex flex-col gap-3" aria-label="Audio traits">
          {traits.map((trait) => {
            const percent = Math.round(sound.traits[trait]! * 100);
            return (
              <li key={trait} className="grid grid-cols-[8.5rem_1fr_2.5rem] items-center gap-4 text-sm">
                <span className="flex flex-col">
                  <span className="capitalize">{trait}</span>
                  <span className="text-xs text-faint-foreground">{traitCopy[trait]}</span>
                </span>
                <span
                  role="meter"
                  aria-label={trait}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={percent}
                  className="relative h-px bg-border"
                >
                  <span
                    className="absolute inset-y-[-1px] left-0 bg-primary motion-safe:transition-[width] motion-safe:duration-700"
                    style={{ width: `${percent}%` }}
                  />
                </span>
                <span className="tabular text-right text-muted-foreground">{percent}</span>
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-xs text-faint-foreground">
        Spotify no longer shares audio features with new apps. Estimates from{" "}
        {sound.sources.map((source, index) => (
          <span key={source.name}>
            {index > 0 && " and "}
            <a href={source.url} target="_blank" rel="noreferrer" className="underline hover:text-foreground">
              {source.name}
            </a>
          </span>
        ))}
        ; time signature isn't available.
      </p>
    </div>
  );
}

function Reading({
  label,
  value,
  unit,
  large,
}: {
  label: string;
  value: string | number | null;
  unit?: string;
  large?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 border-l border-border py-4 pl-4 first:border-l-0 first:pl-0">
      <dt className="eyebrow">{label}</dt>
      <dd className={large ? "font-display text-5xl leading-none tabular" : "font-display text-2xl leading-tight"}>
        {value ?? <span className="text-faint-foreground">—</span>}
        {value != null && unit && <span className="ml-1 font-sans text-xs text-muted-foreground">{unit}</span>}
      </dd>
    </div>
  );
}