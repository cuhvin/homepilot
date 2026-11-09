// "Home Status" strip: the STATUS-block idea from the Dungeon Master prompt pattern,
// computed from real state (not LLM text) so it can never be hallucinated.
import { useStore } from '../store';
import type { HomeState } from '../home/state';

export function homeStatus(h: HomeState): string[] {
  const out: string[] = [];
  const lights = ['living.ceiling', 'living.lamp', 'living.strip'].filter((id) => {
    const s = h[id];
    return s?.kind === 'light' && s.on;
  }).length;
  out.push(`💡 ${lights}/3 lights`);
  const t = h['home.thermostat'];
  if (t?.kind === 'thermostat') out.push(`🌡️ ${Math.round(t.current)}°F → ${t.target}°`);
  const door = h['entry.frontdoor'];
  const garage = h['garage.door'];
  const secure = door?.kind === 'lock' && door.locked && garage?.kind === 'garage' && !garage.open;
  out.push(secure ? '🔒 Secured' : '🔓 Open entry');
  const alarm = h['home.alarm'];
  if (alarm?.kind === 'alarm') out.push(alarm.mode === 'off' ? '🛡️ Disarmed' : `🛡️ Armed (${alarm.mode})`);
  const tv = h['living.tv'];
  if (tv?.kind === 'tv' && tv.on) out.push(`📺 ${tv.input}`);
  const sp = h['living.speaker'];
  if (sp?.kind === 'speaker' && sp.on) out.push(`🎵 ${sp.playlist}`);
  return out;
}

export function HomeStatus() {
  const home = useStore((s) => s.home);
  return (
    <div className="status-strip" aria-label="Home status">
      <span className="status-strip__label">HOME STATUS</span>
      {homeStatus(home).map((s) => <span key={s} className="status-strip__item">{s}</span>)}
    </div>
  );
}
