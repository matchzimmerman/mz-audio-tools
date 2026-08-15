"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CHANNELS,
  FieldChorusEngine,
  ecologicalActivity,
  type ChannelId,
  type Habitat,
  type Region,
  type Season,
} from "../field-chorus-engine";

type Mix = Record<ChannelId, number>;
type Mode = "auto" | "manual";

const REGIONS: Array<{ value: Region; label: string; note: string }> = [
  { value: "piedmont", label: "MD / PA Piedmont", note: "rolling deciduous uplands" },
  { value: "susquehanna", label: "Susquehanna Woods", note: "PA river + forest corridor" },
  { value: "delmarva", label: "Delmarva Lowlands", note: "coastal plain + wet woods" },
  { value: "appalachian", label: "Appalachian Foothills", note: "western ridge / valley forest" },
];

const SEASONS: Array<{ value: Season; label: string }> = [
  { value: "winter", label: "Winter" },
  { value: "earlySpring", label: "Early Spring" },
  { value: "lateSpring", label: "Late Spring" },
  { value: "summer", label: "Summer" },
  { value: "fall", label: "Fall" },
];

const HABITATS: Array<{ value: Habitat; label: string; note: string }> = [
  { value: "forest", label: "Deciduous Forest", note: "closed canopy / leaf litter" },
  { value: "edge", label: "Forest Edge", note: "shrubs / field margin" },
  { value: "wetWoods", label: "Wet Woodland", note: "swampy forest / seep" },
  { value: "reservoir", label: "Reservoir Shore", note: "large still water nearby" },
  { value: "river", label: "River Corridor", note: "moving water / bottomland" },
  { value: "vernal", label: "Vernal Pool", note: "temporary shallow wetland" },
];

const SPEEDS = [
  { value: 0, label: "HOLD" },
  { value: 1, label: "1×" },
  { value: 60, label: "60×" },
  { value: 240, label: "240×" },
  { value: 1440, label: "1440×" },
];

const PRESETS: Array<{
  label: string;
  season: Season;
  habitat: Habitat;
  region: Region;
  hour: number;
}> = [
  { label: "APR / VERNAL / NIGHT", season: "earlySpring", habitat: "vernal", region: "piedmont", hour: 21 },
  { label: "JUN / FOREST / DAWN", season: "lateSpring", habitat: "forest", region: "piedmont", hour: 5.5 },
  { label: "AUG / RESERVOIR / DUSK", season: "summer", habitat: "reservoir", region: "piedmont", hour: 20.5 },
  { label: "SEP / PA WOODS / NIGHT", season: "fall", habitat: "forest", region: "susquehanna", hour: 22 },
];

function blankMix(value = 0): Mix {
  return Object.fromEntries(CHANNELS.map((channel) => [channel.id, value])) as Mix;
}

function clamp(value: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function formatHour(hour: number) {
  const totalMinutes = Math.round(((hour % 24) + 24) % 24 * 60) % (24 * 60);
  const h24 = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const suffix = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 || 12;
  return `${h12}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function seasonName(value: Season) {
  return SEASONS.find((item) => item.value === value)?.label ?? value;
}

function habitatName(value: Habitat) {
  return HABITATS.find((item) => item.value === value)?.label ?? value;
}

function regionName(value: Region) {
  return REGIONS.find((item) => item.value === value)?.label ?? value;
}

function seededPhase(id: string) {
  let hash = 2166136261;
  for (let i = 0; i < id.length; i += 1) hash = Math.imul(hash ^ id.charCodeAt(i), 16777619);
  return ((hash >>> 0) % 6283) / 1000;
}

function useEcologicalMix(
  season: Season,
  habitat: Habitat,
  region: Region,
  hour: number,
  drift: number,
  driftClock: number,
) {
  return useMemo(() => {
    const mix = blankMix();
    CHANNELS.forEach((channel, index) => {
      const base = ecologicalActivity(channel.id, season, habitat, region, hour);
      const phase = seededPhase(channel.id);
      const waveA = Math.sin(driftClock * (0.23 + index * 0.019) + phase);
      const waveB = Math.sin(driftClock * (0.071 + index * 0.007) + phase * 1.71);
      const variation = 1 + drift * (waveA * 0.18 + waveB * 0.11);
      mix[channel.id] = clamp(base * variation);
    });
    return mix;
  }, [drift, driftClock, habitat, hour, region, season]);
}

export default function FieldChorusPage() {
  const engineRef = useRef<FieldChorusEngine | null>(null);
  const activityRef = useRef<Mix>(blankMix());
  const lastClockRef = useRef<number | null>(null);

  const [running, setRunning] = useState(false);
  const [mode, setMode] = useState<Mode>("auto");
  const [region, setRegion] = useState<Region>("piedmont");
  const [season, setSeason] = useState<Season>("summer");
  const [habitat, setHabitat] = useState<Habitat>("forest");
  const [hour, setHour] = useState(20.25);
  const [speed, setSpeed] = useState(240);
  const [drift, setDrift] = useState(0.62);
  const [driftClock, setDriftClock] = useState(0);
  const [master, setMaster] = useState(0.72);
  const [manualMix, setManualMix] = useState<Mix>(() => blankMix());
  const [meters, setMeters] = useState<Mix>(() => blankMix());
  const [muted, setMuted] = useState<Set<ChannelId>>(() => new Set());
  const [status, setStatus] = useState("READY / PRESS START AUDIO");

  const ecologicalMix = useEcologicalMix(season, habitat, region, hour, drift, driftClock);

  const effectiveMix = useMemo(() => {
    const source = mode === "auto" ? ecologicalMix : manualMix;
    const mix = blankMix();
    CHANNELS.forEach((channel) => {
      mix[channel.id] = muted.has(channel.id) ? 0 : source[channel.id];
    });
    return mix;
  }, [ecologicalMix, manualMix, mode, muted]);

  const activeNames = useMemo(
    () =>
      CHANNELS.filter((channel) => effectiveMix[channel.id] > 0.16)
        .sort((a, b) => effectiveMix[b.id] - effectiveMix[a.id])
        .slice(0, 5)
        .map((channel) => channel.name),
    [effectiveMix],
  );

  useEffect(() => {
    const engine = new FieldChorusEngine();
    engine.setActivityProvider(() => activityRef.current);
    engineRef.current = engine;
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    activityRef.current = effectiveMix;
    CHANNELS.forEach((channel) => engineRef.current?.setFader(channel.id, effectiveMix[channel.id]));
  }, [effectiveMix]);

  useEffect(() => {
    engineRef.current?.setMaster(master);
  }, [master]);

  useEffect(() => {
    lastClockRef.current = performance.now();
    if (!running) setMeters(blankMix());
    const timer = window.setInterval(() => {
      if (!running) return;
      const now = performance.now();
      const previous = lastClockRef.current ?? now;
      const dt = Math.min(0.25, Math.max(0, (now - previous) / 1000));
      lastClockRef.current = now;

      setDriftClock((value) => value + dt);
      if (speed > 0) setHour((value) => (value + (dt * speed) / 3600) % 24);

      const next = blankMix();
      CHANNELS.forEach((channel) => {
        next[channel.id] = engineRef.current?.getMeter(channel.id) ?? 0;
      });
      setMeters(next);
    }, 100);
    return () => window.clearInterval(timer);
  }, [running, speed]);

  const toggleAudio = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine) return;
    if (running) {
      engine.stop();
      setRunning(false);
      setStatus("PAUSED / MIX STATE HELD");
      return;
    }
    try {
      await engine.start();
      setRunning(true);
      lastClockRef.current = performance.now();
      setStatus("LIVE / PROCEDURAL ECOLOGY RUNNING");
    } catch (error) {
      setStatus(error instanceof Error ? `AUDIO ERROR / ${error.message}` : "AUDIO ERROR");
    }
  }, [running]);

  const switchMode = (next: Mode) => {
    if (next === "manual" && mode !== "manual") setManualMix(effectiveMix);
    setMode(next);
    setStatus(next === "auto" ? "AUTO ECOLOGY / ENVIRONMENT DRIVES MIX" : "MANUAL MIX / FADERS UNLOCKED");
  };

  const setManualFader = (id: ChannelId, value: number) => {
    setManualMix((previous) => ({ ...previous, [id]: value }));
  };

  const toggleMute = (id: ChannelId) => {
    setMuted((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const applyPreset = (preset: (typeof PRESETS)[number]) => {
    setSeason(preset.season);
    setHabitat(preset.habitat);
    setRegion(preset.region);
    setHour(preset.hour);
    setMode("auto");
    setStatus(`FIELD PRESET / ${preset.label}`);
  };

  const randomSite = () => {
    const nextRegion = REGIONS[Math.floor(Math.random() * REGIONS.length)]?.value ?? "piedmont";
    const nextSeason = SEASONS[Math.floor(Math.random() * SEASONS.length)]?.value ?? "summer";
    const nextHabitat = HABITATS[Math.floor(Math.random() * HABITATS.length)]?.value ?? "forest";
    setRegion(nextRegion);
    setSeason(nextSeason);
    setHabitat(nextHabitat);
    setHour(Math.random() * 24);
    setMode("auto");
    setStatus("RANDOM SITE / NEW ECOLOGY LOADED");
  };

  return (
    <main className="fc-app">
      <style>{STYLES}</style>

      <header className="fc-masthead">
        <div className="fc-plate">MZ–07</div>
        <div className="fc-title-block">
          <h1>FIELD CHORUS</h1>
          <p>MID-ATLANTIC ECOLOGY MIXER / MD · PA · DE</p>
        </div>
        <div className="fc-intro">
          Build a living forest sound field by season, hour, and habitat. Auto Ecology follows a regional activity model; Manual Mix turns every species into a channel strip.
        </div>
      </header>

      <section className="fc-transport" aria-label="Transport and mode controls">
        <button type="button" className="fc-button fc-start" aria-pressed={running} onClick={toggleAudio}>
          {running ? "PAUSE AUDIO" : "START AUDIO"}
        </button>
        <div className="fc-segment" aria-label="Mix mode">
          <button type="button" aria-pressed={mode === "auto"} onClick={() => switchMode("auto")}>AUTO ECOLOGY</button>
          <button type="button" aria-pressed={mode === "manual"} onClick={() => switchMode("manual")}>MANUAL MIX</button>
        </div>
        <button type="button" className="fc-button" onClick={randomSite}>RANDOM SITE</button>
        <label className="fc-master">
          <span>MASTER</span>
          <input type="range" min="0" max="1" step="0.01" value={master} onChange={(event) => setMaster(Number(event.target.value))} />
          <strong>{Math.round(master * 100)}%</strong>
        </label>
      </section>

      <div className="fc-status" role="status" aria-live="polite">
        <span className={running ? "fc-live-dot on" : "fc-live-dot"} aria-hidden="true" />
        {status}
      </div>

      <section className="fc-register" aria-label="Current field observation">
        <RegisterCell label="REGION" value={regionName(region)} />
        <RegisterCell label="SEASON" value={seasonName(season)} />
        <RegisterCell label="HABITAT" value={habitatName(habitat)} />
        <RegisterCell label="FIELD TIME" value={formatHour(hour)} />
        <RegisterCell label="MODE" value={mode === "auto" ? "AUTO ECOLOGY" : "MANUAL"} />
        <RegisterCell label="ACTIVE VOICES" value={String(CHANNELS.filter((channel) => effectiveMix[channel.id] > 0.16).length).padStart(2, "0")} />
      </section>

      <section className="fc-module fc-observation" aria-labelledby="fc-observation-heading">
        <ModuleHeader index="01" title="FIELD CLOCK" note="24-HOUR ACTIVITY MODEL" code="CLK" headingId="fc-observation-heading" />
        <div className="fc-clock-controls">
          <label>
            <span>REGION</span>
            <select value={region} onChange={(event) => setRegion(event.target.value as Region)}>
              {REGIONS.map((item) => <option key={item.value} value={item.value}>{item.label} — {item.note}</option>)}
            </select>
          </label>
          <label>
            <span>SEASON</span>
            <select value={season} onChange={(event) => setSeason(event.target.value as Season)}>
              {SEASONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <label>
            <span>HABITAT</span>
            <select value={habitat} onChange={(event) => setHabitat(event.target.value as Habitat)}>
              {HABITATS.map((item) => <option key={item.value} value={item.value}>{item.label} — {item.note}</option>)}
            </select>
          </label>
        </div>

        <div className="fc-timeline" aria-label={`Modeled 24-hour activity for ${seasonName(season)} at ${habitatName(habitat)}`}>
          <div className="fc-time-row fc-time-head" aria-hidden="true">
            <span />
            {Array.from({ length: 24 }, (_, h) => <i key={h}>{h % 3 === 0 ? String(h).padStart(2, "0") : ""}</i>)}
          </div>
          {CHANNELS.map((channel) => (
            <div className="fc-time-row" key={channel.id}>
              <span>{channel.name}</span>
              {Array.from({ length: 24 }, (_, h) => {
                const value = ecologicalActivity(channel.id, season, habitat, region, h + 0.5);
                const current = Math.floor(hour) === h;
                return (
                  <i
                    key={h}
                    className={current ? "current" : ""}
                    style={{ backgroundColor: `rgba(29,29,27,${(0.03 + value * 0.76).toFixed(3)})` }}
                    title={`${channel.name} · ${String(h).padStart(2, "0")}:00 · ${Math.round(value * 100)}% modeled activity`}
                  />
                );
              })}
            </div>
          ))}
        </div>

        <div className="fc-clock-footer">
          <label className="fc-hour-slider">
            <span>FIELD TIME</span>
            <input type="range" min="0" max="23.99" step="0.05" value={hour} onChange={(event) => setHour(Number(event.target.value))} />
            <strong>{formatHour(hour)}</strong>
          </label>
          <div className="fc-speed" aria-label="Day cycle speed">
            <span>DAY CYCLE</span>
            <div className="fc-segment">
              {SPEEDS.map((item) => (
                <button type="button" key={item.value} aria-pressed={speed === item.value} onClick={() => setSpeed(item.value)}>
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <label className="fc-drift">
            <span>ECOLOGY DRIFT</span>
            <input type="range" min="0" max="1" step="0.01" value={drift} onChange={(event) => setDrift(Number(event.target.value))} />
            <strong>{Math.round(drift * 100)}%</strong>
          </label>
        </div>
      </section>

      <section className="fc-module" aria-labelledby="fc-site-heading">
        <ModuleHeader index="02" title="FIELD PRESETS" note="FAST ENVIRONMENT LOAD" code="ENV" headingId="fc-site-heading" />
        <div className="fc-presets">
          {PRESETS.map((preset) => (
            <button type="button" key={preset.label} className="fc-button" onClick={() => applyPreset(preset)}>
              {preset.label}
            </button>
          ))}
        </div>
        <div className="fc-active-chorus">
          <span>DOMINANT CHORUS</span>
          <strong>{activeNames.length ? activeNames.join(" / ") : "QUIET FIELD"}</strong>
        </div>
      </section>

      <section className="fc-module" aria-labelledby="fc-mixer-heading">
        <ModuleHeader index="03" title="ECOLOGY MIXER" note={mode === "auto" ? "FADERS FOLLOW FIELD MODEL" : "DIRECT MANUAL CONTROL"} code="MIX" headingId="fc-mixer-heading" />
        <div className="fc-mixer">
          {CHANNELS.map((channel, index) => {
            const value = mode === "auto" ? ecologicalMix[channel.id] : manualMix[channel.id];
            const audible = effectiveMix[channel.id];
            const isMuted = muted.has(channel.id);
            return (
              <article className="fc-channel" key={channel.id}>
                <div className="fc-channel-head">
                  <span>{String(index + 1).padStart(2, "0")} / {channel.group}</span>
                  <strong>{channel.name}</strong>
                  <small>{channel.note}</small>
                </div>
                <div className="fc-meter-shell" aria-label={`${channel.name} live audio meter`}>
                  <div className="fc-meter-fill" style={{ height: `${Math.round(meters[channel.id] * 100)}%` }} />
                  <i>LIVE</i>
                </div>
                <label className="fc-fader">
                  <span>LEVEL</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={value}
                    disabled={mode === "auto"}
                    onChange={(event) => setManualFader(channel.id, Number(event.target.value))}
                    aria-label={`${channel.name} level`}
                  />
                  <strong>{Math.round(audible * 100)}</strong>
                </label>
                <button type="button" className="fc-mute" aria-pressed={isMuted} onClick={() => toggleMute(channel.id)}>
                  {isMuted ? "MUTED" : "MUTE"}
                </button>
              </article>
            );
          })}
        </div>
      </section>

      <section className="fc-module fc-notes" aria-labelledby="fc-notes-heading">
        <ModuleHeader index="04" title="FIELD NOTES" note="MODEL BASIS + LIMITS" code="REF" headingId="fc-notes-heading" />
        <div className="fc-note-grid">
          <p>
            <strong>THIS BUILD USES SYNTHETIC SOUND MODELS.</strong> The calls are procedural approximations designed to make the ecological mixer playable now; they are not recordings and should not be used for species identification.
          </p>
          <p>
            Seasonal and daily activity are an interpretive Mid-Atlantic model informed by regional field guides. Spring peepers and chorus frogs peak early; green frogs and bullfrogs rise near larger water later in spring and summer; cicadas dominate hot summer days; crickets and katydids rise after dusk.
          </p>
          <div className="fc-sources">
            <a href="https://dnr.maryland.gov/wildlife/Pages/plants_wildlife/herps/fieldguide_OrderAnura.aspx" target="_blank" rel="noreferrer">MD DNR / FROGS + TOADS ↗</a>
            <a href="https://extension.psu.edu/summer-garden-visitors" target="_blank" rel="noreferrer">PENN STATE / SUMMER INSECTS ↗</a>
            <a href="https://www.allaboutbirds.org/guide/Wood_Thrush/overview" target="_blank" rel="noreferrer">CORNELL / WOOD THRUSH ↗</a>
            <a href="https://dnrec.delaware.gov/outdoor-delaware/gone-herpin/" target="_blank" rel="noreferrer">DE DNREC / HERP ATLAS ↗</a>
          </div>
        </div>
      </section>

      <footer className="fc-footer">
        <Link href="/">← MZ AUDIO TOOLS</Link>
        <span>FIELD CHORUS / MZ–07 / PROCEDURAL ECOLOGY INSTRUMENT</span>
        <span>PHASE 01 · MIXER + DAY CYCLE</span>
      </footer>
    </main>
  );
}

function RegisterCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ModuleHeader({
  index,
  title,
  note,
  code,
  headingId,
}: {
  index: string;
  title: string;
  note: string;
  code: string;
  headingId: string;
}) {
  return (
    <header className="fc-module-head">
      <span className="fc-index">{index}</span>
      <div>
        <h2 id={headingId}>{title}</h2>
        <p>{note}</p>
      </div>
      <b>{code}</b>
    </header>
  );
}

const STYLES = `
.fc-app{ width:min(100%,1720px); min-height:100vh; margin:0 auto; padding:24px 30px 18px; background:var(--paper); color:var(--ink); }
.fc-app *{ box-sizing:border-box; }
.fc-app button,.fc-app input,.fc-app select{ font-family:var(--mono); }

.fc-masthead{ display:grid; grid-template-columns:58px minmax(0,1fr) minmax(260px,420px); gap:16px; align-items:end; border-top:2px solid var(--ink); border-bottom:2px solid var(--ink); padding:13px 0 15px; }
.fc-plate{ align-self:stretch; display:grid; place-items:center; border:1px solid var(--ink); background:var(--acid); font:900 11px/1 var(--mono); letter-spacing:.08em; writing-mode:vertical-rl; transform:rotate(180deg); }
.fc-title-block h1{ margin:0; font-size:clamp(48px,7vw,96px); line-height:.78; letter-spacing:-.07em; font-weight:900; }
.fc-title-block p{ margin:10px 0 0; font:800 10px/1.2 var(--mono); letter-spacing:.13em; color:var(--muted); }
.fc-intro{ font-size:13px; line-height:1.55; max-width:46ch; justify-self:end; }

.fc-transport{ display:grid; grid-template-columns:170px minmax(250px,1fr) 150px minmax(240px,360px); border-bottom:1px solid var(--ink); }
.fc-button,.fc-segment button,.fc-mute{ min-height:44px; border:0; border-right:1px solid var(--ink); background:transparent; color:var(--ink); padding:9px 12px; font:800 10px/1 var(--mono); letter-spacing:.08em; text-transform:uppercase; transition:background .14s ease; }
.fc-button:hover,.fc-button:focus-visible,.fc-segment button:hover,.fc-segment button:focus-visible,.fc-mute:hover,.fc-mute:focus-visible{ background:var(--paper-light); }
.fc-button[aria-pressed="true"],.fc-segment button[aria-pressed="true"],.fc-mute[aria-pressed="true"]{ background:var(--acid); }
.fc-start{ border-left:1px solid var(--ink); }
.fc-start[aria-pressed="true"]{ background:var(--acid); }
.fc-segment{ display:grid; grid-auto-flow:column; grid-auto-columns:1fr; }
.fc-segment button:last-child{ border-right:1px solid var(--ink); }
.fc-master{ min-height:44px; display:grid; grid-template-columns:auto 1fr 44px; align-items:center; gap:8px; border-right:1px solid var(--ink); padding:8px 10px; }
.fc-master span,.fc-master strong,.fc-hour-slider span,.fc-hour-slider strong,.fc-drift span,.fc-drift strong,.fc-speed>span{ font:800 9px/1 var(--mono); letter-spacing:.08em; }
.fc-master strong,.fc-hour-slider strong,.fc-drift strong{ text-align:right; font-variant-numeric:tabular-nums; }
.fc-master input,.fc-hour-slider input,.fc-drift input,.fc-fader input{ accent-color:var(--ink); width:100%; }

.fc-status{ min-height:31px; display:flex; align-items:center; gap:8px; border-bottom:1px solid var(--ink); padding:6px 10px; font:800 9px/1 var(--mono); letter-spacing:.09em; color:var(--muted); }
.fc-live-dot{ width:8px; height:8px; border:1px solid var(--ink); background:transparent; }
.fc-live-dot.on{ background:var(--acid); }

.fc-register{ display:grid; grid-template-columns:repeat(6,1fr); border-bottom:2px solid var(--ink); }
.fc-register>div{ min-width:0; padding:9px 10px 10px; border-right:1px solid var(--line); }
.fc-register>div:last-child{ border-right:0; }
.fc-register span{ display:block; margin-bottom:4px; color:var(--muted); font:800 8px/1 var(--mono); letter-spacing:.1em; }
.fc-register strong{ display:block; font:800 12px/1.15 var(--mono); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

.fc-module{ border-bottom:1px solid var(--ink); padding:16px 0 18px; }
.fc-module-head{ display:grid; grid-template-columns:26px minmax(0,1fr) auto; gap:9px; align-items:center; margin-bottom:13px; }
.fc-index{ width:26px; height:26px; display:grid; place-items:center; border:1px solid var(--ink); background:var(--acid); font:900 9px/1 var(--mono); }
.fc-module-head h2{ margin:0; font-size:20px; line-height:1; letter-spacing:-.03em; font-weight:900; }
.fc-module-head p{ margin:3px 0 0; color:var(--muted); font:800 8px/1 var(--mono); letter-spacing:.1em; }
.fc-module-head b{ color:var(--muted); font:800 8px/1 var(--mono); letter-spacing:.12em; }

.fc-clock-controls{ display:grid; grid-template-columns:repeat(3,1fr); border-top:1px solid var(--ink); border-left:1px solid var(--ink); }
.fc-clock-controls label{ min-width:0; display:block; border-right:1px solid var(--ink); border-bottom:1px solid var(--ink); padding:9px 10px; }
.fc-clock-controls span{ display:block; margin-bottom:6px; color:var(--muted); font:800 8px/1 var(--mono); letter-spacing:.1em; }
.fc-clock-controls select{ width:100%; min-height:44px; border:0; background:var(--paper-light); color:var(--ink); font:800 11px/1.2 var(--mono); }

.fc-timeline{ border:1px solid var(--ink); border-top:0; padding:9px 9px 10px; overflow:hidden; background-image:linear-gradient(var(--line) 1px,transparent 1px); background-size:100% 24px; }
.fc-time-row{ display:grid; grid-template-columns:142px repeat(24,minmax(0,1fr)); min-height:24px; align-items:stretch; }
.fc-time-row>span{ display:flex; align-items:center; padding-right:8px; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; font:800 8px/1 var(--mono); letter-spacing:.04em; }
.fc-time-row>i{ min-width:0; border-left:1px solid rgba(29,29,27,.11); }
.fc-time-row>i.current{ box-shadow:inset 2px 0 0 var(--acid), inset -2px 0 0 var(--acid); }
.fc-time-head{ min-height:18px; }
.fc-time-head>i{ background:transparent; border-left:0; color:var(--muted); font:700 7px/1 var(--mono); font-style:normal; }

.fc-clock-footer{ display:grid; grid-template-columns:minmax(320px,1.4fr) minmax(360px,1fr) minmax(260px,.8fr); border-left:1px solid var(--ink); }
.fc-hour-slider,.fc-drift{ min-height:58px; display:grid; grid-template-columns:auto 1fr 76px; gap:10px; align-items:center; border-right:1px solid var(--ink); border-bottom:1px solid var(--ink); padding:9px 10px; }
.fc-speed{ min-height:58px; display:grid; grid-template-rows:auto 1fr; gap:6px; border-right:1px solid var(--ink); border-bottom:1px solid var(--ink); padding:7px 8px 8px; }
.fc-speed .fc-segment{ border:1px solid var(--ink); }
.fc-speed .fc-segment button{ min-height:30px; padding:4px 6px; font-size:8px; }
.fc-speed .fc-segment button:last-child{ border-right:0; }

.fc-presets{ display:grid; grid-template-columns:repeat(4,1fr); border-left:1px solid var(--ink); border-top:1px solid var(--ink); }
.fc-presets .fc-button{ border-bottom:1px solid var(--ink); }
.fc-active-chorus{ display:grid; grid-template-columns:150px 1fr; gap:12px; align-items:center; border:1px solid var(--ink); border-top:0; padding:10px; }
.fc-active-chorus span{ color:var(--muted); font:800 8px/1 var(--mono); letter-spacing:.1em; }
.fc-active-chorus strong{ font:900 12px/1.3 var(--mono); }

.fc-mixer{ display:grid; grid-template-columns:repeat(6,1fr); border-left:1px solid var(--ink); border-top:1px solid var(--ink); }
.fc-channel{ min-width:0; display:grid; grid-template-columns:1fr 24px; grid-template-rows:auto auto auto; border-right:1px solid var(--ink); border-bottom:1px solid var(--ink); }
.fc-channel-head{ grid-column:1/-1; min-height:88px; padding:9px 9px 8px; border-bottom:1px solid var(--line); }
.fc-channel-head>span{ display:block; color:var(--muted); font:800 7px/1 var(--mono); letter-spacing:.1em; }
.fc-channel-head strong{ display:block; margin-top:5px; font-size:14px; line-height:1.05; letter-spacing:-.02em; }
.fc-channel-head small{ display:block; margin-top:5px; color:var(--muted); font:700 8px/1.25 var(--mono); }
.fc-meter-shell{ grid-column:2; grid-row:2; position:relative; min-height:102px; border-left:1px solid var(--line); background:var(--paper-light); overflow:hidden; }
.fc-meter-fill{ position:absolute; left:0; right:0; bottom:0; background:var(--acid); border-top:1px solid var(--ink); transition:height .08s linear; }
.fc-meter-shell i{ position:absolute; left:50%; bottom:5px; transform:translateX(-50%) rotate(-90deg); color:var(--muted); font:700 6px/1 var(--mono); font-style:normal; letter-spacing:.08em; }
.fc-fader{ grid-column:1; grid-row:2; min-height:102px; display:grid; grid-template-rows:auto 1fr auto; gap:7px; padding:9px; }
.fc-fader span{ color:var(--muted); font:800 8px/1 var(--mono); letter-spacing:.1em; }
.fc-fader strong{ font:900 17px/1 var(--mono); font-variant-numeric:tabular-nums; }
.fc-fader input:disabled{ opacity:.45; }
.fc-mute{ grid-column:1/-1; grid-row:3; min-height:36px; border-top:1px solid var(--line); border-right:0; font-size:8px; }

.fc-note-grid{ display:grid; grid-template-columns:1fr 1fr; gap:0; border:1px solid var(--ink); }
.fc-note-grid p{ margin:0; padding:12px; font-size:12px; line-height:1.55; border-right:1px solid var(--ink); }
.fc-note-grid p strong{ font-family:var(--mono); font-size:9px; letter-spacing:.07em; }
.fc-sources{ grid-column:1/-1; display:grid; grid-template-columns:repeat(4,1fr); border-top:1px solid var(--ink); }
.fc-sources a{ min-height:44px; display:flex; align-items:center; padding:9px 10px; border-right:1px solid var(--ink); color:var(--ink); text-decoration:none; font:800 8px/1.25 var(--mono); letter-spacing:.05em; }
.fc-sources a:last-child{ border-right:0; }
.fc-sources a:hover,.fc-sources a:focus-visible{ background:var(--acid); }

.fc-footer{ display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap; padding:14px 0 0; color:var(--muted); font:800 8px/1.2 var(--mono); letter-spacing:.08em; }
.fc-footer a{ color:var(--ink); text-decoration:none; }
.fc-footer a:hover,.fc-footer a:focus-visible{ background:var(--acid); }

@media(max-width:1180px){
  .fc-masthead{ grid-template-columns:48px 1fr; }
  .fc-intro{ grid-column:2; justify-self:start; }
  .fc-transport{ grid-template-columns:150px 1fr 140px; }
  .fc-master{ grid-column:1/-1; border-left:1px solid var(--ink); }
  .fc-register{ grid-template-columns:repeat(3,1fr); }
  .fc-register>div:nth-child(3n){ border-right:0; }
  .fc-register>div:nth-child(-n+3){ border-bottom:1px solid var(--line); }
  .fc-clock-footer{ grid-template-columns:1fr 1fr; }
  .fc-drift{ grid-column:1/-1; }
  .fc-mixer{ grid-template-columns:repeat(4,1fr); }
}

@media(max-width:820px){
  .fc-app{ padding:16px 15px 14px; }
  .fc-title-block h1{ font-size:clamp(44px,12vw,72px); }
  .fc-transport{ grid-template-columns:1fr 1fr; border-left:1px solid var(--ink); }
  .fc-transport>.fc-segment{ grid-column:1/-1; border-top:1px solid var(--ink); }
  .fc-start,.fc-button{ border-left:0; }
  .fc-master{ grid-column:1/-1; }
  .fc-register{ grid-template-columns:repeat(2,1fr); }
  .fc-register>div,.fc-register>div:nth-child(3n){ border-right:1px solid var(--line); border-bottom:1px solid var(--line); }
  .fc-register>div:nth-child(2n){ border-right:0; }
  .fc-register>div:nth-last-child(-n+2){ border-bottom:0; }
  .fc-clock-controls{ grid-template-columns:1fr; }
  .fc-time-row{ grid-template-columns:96px repeat(24,minmax(0,1fr)); min-height:22px; }
  .fc-time-row>span{ font-size:7px; }
  .fc-clock-footer{ grid-template-columns:1fr; }
  .fc-hour-slider,.fc-speed,.fc-drift{ grid-column:auto; }
  .fc-presets{ grid-template-columns:repeat(2,1fr); }
  .fc-active-chorus{ grid-template-columns:1fr; }
  .fc-mixer{ grid-template-columns:repeat(3,1fr); }
  .fc-note-grid{ grid-template-columns:1fr; }
  .fc-note-grid p{ border-right:0; border-bottom:1px solid var(--ink); }
  .fc-sources{ grid-template-columns:repeat(2,1fr); }
  .fc-sources a:nth-child(2){ border-right:0; }
  .fc-sources a:nth-child(-n+2){ border-bottom:1px solid var(--ink); }
}

@media(max-width:560px){
  .fc-masthead{ grid-template-columns:38px 1fr; gap:10px; }
  .fc-intro{ font-size:12px; }
  .fc-transport{ grid-template-columns:1fr; }
  .fc-transport>.fc-segment,.fc-master{ grid-column:auto; }
  .fc-button,.fc-segment button,.fc-master{ border-right:1px solid var(--ink); border-bottom:1px solid var(--ink); }
  .fc-register{ grid-template-columns:1fr; }
  .fc-register>div,.fc-register>div:nth-child(2n),.fc-register>div:nth-child(3n){ border-right:0; border-bottom:1px solid var(--line); }
  .fc-register>div:last-child{ border-bottom:0; }
  .fc-time-row{ grid-template-columns:82px repeat(24,minmax(0,1fr)); }
  .fc-time-row>span{ font-size:6px; letter-spacing:0; }
  .fc-clock-footer{ border-right:1px solid var(--ink); }
  .fc-hour-slider,.fc-drift{ grid-template-columns:1fr 62px; }
  .fc-hour-slider span,.fc-drift span{ grid-column:1/-1; }
  .fc-presets{ grid-template-columns:1fr; }
  .fc-mixer{ grid-template-columns:repeat(2,1fr); }
  .fc-sources{ grid-template-columns:1fr; }
  .fc-sources a,.fc-sources a:nth-child(2){ border-right:0; border-bottom:1px solid var(--ink); }
  .fc-sources a:last-child{ border-bottom:0; }
}

@media(prefers-reduced-motion:reduce){
  .fc-button,.fc-segment button,.fc-mute,.fc-meter-fill{ transition:none; }
}
`;
