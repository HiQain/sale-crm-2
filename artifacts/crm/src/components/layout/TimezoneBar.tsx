import { useState, useEffect } from "react";

interface TZSlot {
  label: string;
  tz: string;
}

const ZONES: TZSlot[] = [
  { label: "EST", tz: "America/New_York" },
  { label: "CST", tz: "America/Chicago" },
  { label: "MST", tz: "America/Denver" },
  { label: "PST", tz: "America/Los_Angeles" },
  { label: "PKT", tz: "Asia/Karachi" },
];

function formatTZ(tz: string) {
  return new Date().toLocaleTimeString("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function TimezoneBar() {
  const [times, setTimes] = useState(() => ZONES.map(z => formatTZ(z.tz)));

  useEffect(() => {
    const tick = () => setTimes(ZONES.map(z => formatTZ(z.tz)));
    tick();
    const id = setInterval(tick, 10_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="bg-[#1a1f2e] text-white/80 text-xs flex items-center justify-center gap-0 px-4 py-2 select-none">
      {ZONES.map((z, i) => (
        <span key={z.label} className="flex items-center">
          {i > 0 && <span className="mx-4 text-white/20">|</span>}
          <span className="text-white font-medium tracking-wider mr-1.5">{z.label}</span>
          <span className="font-semibold text-white/90">{times[i]}</span>
        </span>
      ))}
    </div>
  );
}
