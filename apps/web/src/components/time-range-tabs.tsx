import { Tabs, TabsList, TabsTrigger } from "@spotify-stats/ui/components/tabs";

import { TIME_RANGES, type TimeRange } from "@/lib/format";

/** Switches between Spotify's three approximate affinity windows. */
export function TimeRangeTabs({
  value,
  onChange,
}: {
  value: TimeRange;
  onChange: (value: TimeRange) => void;
}) {
  return (
    <Tabs value={value} onValueChange={(next) => onChange(next as TimeRange)}>
      <TabsList variant="line" aria-label="Time window">
        {TIME_RANGES.map((range) => (
          <TabsTrigger key={range.value} value={range.value} className="min-h-10 px-3">
            {range.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
