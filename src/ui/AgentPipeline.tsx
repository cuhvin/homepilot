// "How HomePilot handled it": the agent loop as six pixel-icon stages that light up
// as the most recent request moves through them. Everything is derived from store state.
import { useStore } from '../store';

type Status = 'idle' | 'active' | 'done' | 'wait' | 'error' | 'skip';

// 9x9 single-color pixel icons ('X' = filled), drawn in currentColor
const ICONS: Record<string, string[]> = {
  you: ['...XXX...', '..XXXXX..', '..XXXXX..', '...XXX...', '.........', '.XXXXXXX.', 'XXXXXXXXX', 'XXXXXXXXX', '.........'],
  gemini: ['....X....', '....X....', '...XXX...', '..XXXXX..', 'XXXXXXXXX', '..XXXXX..', '...XXX...', '....X....', '....X....'],
  shield: ['XXXXXXXXX', 'X.......X', 'X.....X.X', 'X....XX.X', 'XX..XX.XX', '.XXXX..X.', '..XX..X..', '...XXX...', '.........'],
  key: ['.........', '.XXX.....', 'X...X....', 'X...XXXXX', 'X...X.X.X', '.XXX..X.X', '.........', '.........', '.........'],
  bolt: ['.....XXX.', '....XXX..', '...XXX...', '..XXXXXX.', '.XXXXXX..', '....XXX..', '...XXX...', '..XX.....', '.X.......'],
  log: ['XXXXXXX..', 'X.....XX.', 'X.XXX..X.', 'X......X.', 'X.XXXX.X.', 'X......X.', 'X.XXX..X.', 'X......X.', 'XXXXXXXX.'],
};

function PixelIcon({ name }: { name: string }) {
  return (
    <svg viewBox="-0.5 -0.5 10 10" width="22" height="22" shapeRendering="crispEdges" aria-hidden="true">
      {ICONS[name].flatMap((row, y) => [...row].map((c, x) => (c === 'X' ? <rect key={`${x}-${y}`} x={x} y={y} width="1.02" height="1.02" fill="currentColor" /> : null)))}
    </svg>
  );
}

interface Stage { key: string; icon: string; name: string; caption: string; status: Status }

function truncate(s: string, n: number) {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

export function AgentPipeline() {
  const pipeline = useStore((s) => s.pipeline);
  const plan = useStore((s) => (s.pipeline.planId ? s.plans[s.pipeline.planId] : undefined));
  const logCount = useStore((s) => s.log.length);

  const steps = plan?.steps ?? [];
  const n = (st: string) => steps.filter((x) => x.status === st).length;
  const blocked = n('blocked');
  const awaiting = n('awaiting');
  const ran = n('done');
  const scheduled = n('scheduled');
  const rejected = n('rejected');
  const sensitive = steps.filter((x) => x.risk === 'sensitive').length;
  const kind = plan?.response.kind;
  const { phase } = pipeline;
  const idle = phase === 'idle';

  const stages: Stage[] = [
    {
      key: 'you', icon: 'you', name: 'You ask',
      caption: idle ? 'Type a request' : `“${truncate(pipeline.request, 26)}”`,
      status: idle ? 'idle' : 'done',
    },
    {
      key: 'llm', icon: 'gemini', name: 'Gemini plans',
      caption: phase === 'planning' ? 'Reading the home state…' : phase === 'error' ? pipeline.error ?? 'Failed' : kind === 'plan' ? `${steps.length}-step JSON plan` : kind === 'clarify' ? 'Asked a question' : kind === 'refuse' ? 'Out of scope' : 'Structured JSON plan',
      status: phase === 'planning' ? 'active' : phase === 'error' ? 'error' : phase === 'done' ? 'done' : 'idle',
    },
    {
      key: 'validate', icon: 'shield', name: 'Validator checks',
      caption: phase !== 'done' ? 'Devices, ranges, risk' : kind !== 'plan' ? 'Nothing to check' : `${steps.length - blocked} ok${blocked ? ` · ${blocked} blocked` : ''}${sensitive ? ` · ${sensitive} sensitive` : ''}`,
      status: phase !== 'done' ? 'idle' : kind !== 'plan' ? 'skip' : blocked ? 'error' : 'done',
    },
    {
      key: 'ok', icon: 'key', name: 'Your OK',
      caption: phase !== 'done' || kind !== 'plan' ? 'Only for security steps' : awaiting ? `Waiting on ${awaiting} step${awaiting > 1 ? 's' : ''}` : sensitive ? `${sensitive - rejected} allowed${rejected ? ` · ${rejected} denied` : ''}` : 'Not needed',
      status: phase !== 'done' || kind !== 'plan' ? 'idle' : awaiting ? 'wait' : sensitive ? 'done' : 'skip',
    },
    {
      key: 'act', icon: 'bolt', name: 'Actor runs',
      caption: phase !== 'done' || kind !== 'plan' ? 'Devices + schedules' : !ran && !scheduled && awaiting ? 'Waits for your OK' : `${ran} done${scheduled ? ` · ${scheduled} scheduled` : ''}`,
      status: phase !== 'done' || kind !== 'plan' ? 'idle' : ran || scheduled ? 'done' : awaiting ? 'wait' : 'skip',
    },
    {
      key: 'log', icon: 'log', name: 'Audit log',
      caption: `${logCount} entr${logCount === 1 ? 'y' : 'ies'} recorded`,
      status: logCount ? 'done' : 'idle',
    },
  ];

  return (
    <section className="pipe" aria-label="How HomePilot handled the last request">
      <h3 className="pipe__title">HOW HOMEPILOT HANDLED IT</h3>
      <ol className="pipe__row">
        {stages.map((st, i) => (
          <li key={st.key} className={`pipe__stage is-${st.status}`}>
            {i > 0 && <span className={`pipe__link ${stages[i - 1].status === 'done' && st.status !== 'idle' ? 'is-flow' : ''}`} aria-hidden="true" />}
            <span className="pipe__icon"><PixelIcon name={st.icon} /></span>
            <span className="pipe__text">
              <strong>{st.name}</strong>
              <span>{st.caption}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
