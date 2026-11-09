// Static "How to use" card with pixel-art icons, sitting under the street view.

// 9x9 pixel icons ('X' = filled), drawn in currentColor
const ICONS: Record<string, string[]> = {
  chat: ['.........', 'XXXXXXXXX', 'X.......X', 'X.X.X.X.X', 'X.......X', 'XXXXXXXXX', '.XX......', '.X.......', '.........'],
  key: ['.........', '.XXX.....', 'X...X....', 'X...XXXXX', 'X...X.X.X', '.XXX..X.X', '.........', '.........', '.........'],
  clock: ['..XXXXX..', '.X.....X.', 'X...X...X', 'X...X...X', 'X...XXX.X', 'X.......X', 'X.......X', '.X.....X.', '..XXXXX..'],
  log: ['XXXXXXX..', 'X.....XX.', 'X.XXX..X.', 'X......X.', 'X.XXXX.X.', 'X......X.', 'X.XXX..X.', 'X......X.', 'XXXXXXXX.'],
};

function PixelIcon({ name }: { name: string }) {
  return (
    <svg viewBox="-0.5 -0.5 10 10" width="22" height="22" shapeRendering="crispEdges" aria-hidden="true">
      {ICONS[name].flatMap((row, y) => [...row].map((c, x) => (c === 'X' ? <rect key={`${x}-${y}`} x={x} y={y} width="1.02" height="1.02" fill="currentColor" /> : null)))}
    </svg>
  );
}

const TIPS = [
  { icon: 'chat', title: 'Just ask', text: 'Type what you want, like “movie night”. HomePilot plans the steps for you.' },
  { icon: 'key', title: 'You hold the keys', text: 'Unlocking the door, the garage, the alarm and cameras always wait for your Allow.' },
  { icon: 'clock', title: 'Speed up time', text: 'Schedules run on the SIM clock. Use 10×, 60× or 1h to watch them happen.' },
  { icon: 'log', title: 'Everything is logged', text: 'The Audit log tab records every request, plan and action.' },
];

export function HowToUse() {
  return (
    <section className="howto" aria-label="How to use HomePilot">
      <h3 className="howto__title">HOW TO USE</h3>
      <ul className="howto__grid">
        {TIPS.map((t) => (
          <li key={t.title} className="howto__tip">
            <span className="howto__icon"><PixelIcon name={t.icon} /></span>
            <span className="howto__text">
              <strong>{t.title}</strong>
              <span>{t.text}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
