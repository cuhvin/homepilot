import { Download, Trash } from 'lucide-react';
import { useStore } from '../store';
import { downloadLog } from '../agent/log';

export function LogPanel() {
  const log = useStore((s) => s.log);
  const clearLog = useStore((s) => s.clearLog);
  const entries = [...log].reverse();
  return (
    <div className="logp">
      <div className="logp__bar">
        <span className="muted">{log.length} entries · saved in this browser</span>
        <button className="btn btn--ghost" onClick={() => downloadLog(log)} disabled={!log.length}><Download size={14} /> JSON</button>
        <button className="btn btn--ghost" onClick={() => { if (confirm('Clear the audit log in this browser?')) clearLog(); }} disabled={!log.length}><Trash size={14} /> Clear</button>
      </div>
      <ol className="logp__list">
        {entries.length === 0 && <li className="muted">No actions yet. Everything the agent does is recorded here.</li>}
        {entries.map((e) => (
          <li key={e.id} className={`entry entry--${e.type}`}>
            <div className="entry__head">
              <span className="entry__type">{e.type.replace('_', ' ')}</span>
              <time title={e.at}>{e.sim} · {new Date(e.at).toLocaleTimeString()}</time>
            </div>
            <p>{e.message}</p>
            {e.data !== undefined && (
              <details>
                <summary>details</summary>
                <pre>{JSON.stringify(e.data, null, 2)}</pre>
              </details>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
