export const LIVE_DURATION = 60_000;
export const DEMO_DURATION = 8_000;
export const LEAD_IN = 3_000;
export const SETTLEMENT_GRACE = 120_000;
export const SAVE_KEY = 'squeek-wheel-oracle:v1';
export type Mode = 'live' | 'demo';
export type Choice = 'under' | 'over';
export type SourceStatus = 'LIVE' | 'STALE' | 'OFFLINE' | 'SYNCING';
export interface WindowResult { start: number; end: number; work: number; startCount: number; endCount: number }
export interface Forecast { mean: number | null; choice: Choice | null; samples: WindowResult[] }
export interface Draft { id: string; mode: Mode; target: number; duration: number; forecast: Forecast; preparedAt: number }
export interface Round extends Draft {
  choice: Choice; lockedAt: number; start: number; end: number;
  installation: string; epoch: string; demoTotal?: number;
}
export interface HistoryEntry extends Round {
  result: 'correct' | 'incorrect' | 'void'; actual: number | null;
  points: number; bonus: number; algorithmCorrect: boolean | null;
  settledAt: number; reason: string; evidence: WindowResult | null;
}
export interface Progress {
  score: number; streak: number; bestStreak: number; wins: number; losses: number;
  bossHp: number; bosses: number; algorithmWins: number; algorithmRounds: number;
  history: HistoryEntry[]; active: Round | null; lastMessage: string;
}
export interface Save { version: 1; mode: Mode; sound: boolean; motion: boolean; live: Progress; demo: Progress }
export const emptyProgress = (): Progress => ({
  score: 0, streak: 0, bestStreak: 0, wins: 0, losses: 0, bossHp: 100, bosses: 0,
  algorithmWins: 0, algorithmRounds: 0, history: [], active: null,
  lastMessage: 'The city sleeps. A very small hero takes the night shift.',
});
export const newSave = (): Save => ({version: 1, mode: 'live', sound: false, motion: true, live: emptyProgress(), demo: emptyProgress()});
export const outcome = (work: number, target: number): Choice => work >= target ? 'over' : 'under';
export const labelChoice = (choice: Choice | null) => choice === 'over' ? 'AT/OVER' : choice === 'under' ? 'UNDER' : 'Learning';

export function forecast(windows: WindowResult[], duration: number, before: number, target: number): Forecast {
  const samples = windows.filter(w => w.end <= before && w.end - w.start === duration && w.work >= 0)
    .sort((a,b) => a.end-b.end).slice(-5);
  const mean = samples.length ? samples.reduce((n,w) => n+w.work,0)/samples.length : null;
  return { samples, mean, choice: mean === null ? null : outcome(mean, target) };
}
export function makeDraft(mode: Mode, windows: WindowResult[], now: number, sequence: number): Draft {
  const duration = mode === 'live' ? LIVE_DURATION : DEMO_DURATION;
  const initial = forecast(windows, duration, now, 1);
  // A game target, never a fabricated measurement. Alternating challenge factors are public.
  const factor = [1.1, 0.9, 1.05, 0.95][sequence % 4];
  const target = Math.max(1, Math.round((initial.mean ?? (mode === 'demo' ? 10 : 1)) * factor));
  return { id: `${mode}-${now}-${sequence}`, mode, duration, target, forecast: forecast(windows,duration,now,target), preparedAt: now };
}
export function lockRound(draft: Draft, choice: Choice, now: number, installation: string, epoch: string, demoTotal?: number): Round {
  return {...draft, choice, lockedAt: now, start: now+LEAD_IN, end: now+LEAD_IN+draft.duration, installation, epoch,
    ...(draft.mode === 'demo' ? {demoTotal} : {})};
}
export function completeRound(progress: Progress, actual: WindowResult | null, now: number, reason = ''): Progress {
  const round = progress.active;
  if (!round || progress.history.some(h => h.id === round.id)) return progress;
  if (actual && (now < round.end || actual.start !== round.start || actual.end !== round.end || actual.work < 0
      || !Number.isSafeInteger(actual.work) || actual.endCount-actual.startCount !== actual.work)) return progress;
  const correct = actual !== null && outcome(actual.work,round.target) === round.choice;
  const streak = actual === null ? progress.streak : correct ? progress.streak+1 : 0;
  const bonus = correct ? Math.min((streak-1)*10,50) : 0;
  const points = correct ? 100+bonus : 0;
  const defeated = correct && progress.bossHp === 20;
  const algorithmCorrect = actual && round.forecast.choice !== null ? outcome(actual.work,round.target) === round.forecast.choice : null;
  const entry: HistoryEntry = {...round, result: actual === null ? 'void' : correct ? 'correct' : 'incorrect', actual: actual?.work ?? null,
    points, bonus, algorithmCorrect, settledAt: now, reason, evidence: actual};
  return {...progress, active: null, history: [entry,...progress.history].slice(0,100), score: progress.score+points,
    streak, bestStreak: Math.max(progress.bestStreak,streak), wins: progress.wins+(correct?1:0),
    losses: progress.losses+(actual && !correct ? 1:0), bossHp: correct ? defeated ? 100 : progress.bossHp-20 : progress.bossHp,
    bosses: progress.bosses+(defeated?1:0), algorithmWins: progress.algorithmWins+(algorithmCorrect?1:0),
    algorithmRounds: progress.algorithmRounds+(algorithmCorrect !== null?1:0),
    lastMessage: actual === null ? `Round void. ${reason}` : defeated ? 'The Vacuum collapses. The city exhales. Another one rolls into the dark.'
      : correct ? ['A tiny paw. A mighty hit. The Vacuum loses 20 HP.','The lights flicker back on. Your forecast hits for 20 damage.','Squeektoshi keeps the city running. Another 20 HP down.'][progress.wins%3]
      : 'The future took a different turn. The Vacuum survives; your next call awaits.',
  };
}

export function demoWindows(progress: Progress): WindowResult[] {
  return progress.history.filter(h=>h.mode==='demo' && h.evidence!==null).map(h=>h.evidence!);
}
const uint = (v: unknown): v is number => typeof v==='number' && Number.isSafeInteger(v) && v>=0;
const obj = (v: unknown): v is Record<string,unknown> => !!v && typeof v==='object' && !Array.isArray(v);
function validWindow(v: unknown): v is WindowResult {
  return obj(v) && ['start','end','work','startCount','endCount'].every(k=>uint(v[k])) && Number(v.end)>Number(v.start)
    && Number(v.endCount)-Number(v.startCount)===v.work;
}
function validRound(v: unknown, mode: Mode): v is Round {
  if (!obj(v) || v.mode!==mode || typeof v.id!=='string' || !['under','over'].includes(String(v.choice))
    || !['target','duration','preparedAt','lockedAt','start','end'].every(k=>uint(v[k])) || Number(v.target)<1
    || v.duration!==(mode==='live'?LIVE_DURATION:DEMO_DURATION) || Number(v.end)-Number(v.start)!==v.duration
    || Number(v.start)-Number(v.lockedAt)!==LEAD_IN || typeof v.installation!=='string' || typeof v.epoch!=='string'
    || !obj(v.forecast) || !Array.isArray(v.forecast.samples) || v.forecast.samples.length>5 || !v.forecast.samples.every(validWindow)) return false;
  const f = v.forecast;
  if (!(f.mean===null || typeof f.mean==='number' && Number.isFinite(f.mean) && f.mean>=0)
    || !(f.choice===null || f.choice==='under' || f.choice==='over')) return false;
  return mode!=='demo' || uint(v.demoTotal) && v.demoTotal<=30;
}
export function parseSave(raw: string | null): Save | null {
  if (!raw) return null;
  try {
    const s: unknown = JSON.parse(raw);
    if (!obj(s) || s.version!==1 || !['live','demo'].includes(String(s.mode)) || typeof s.sound!=='boolean' || typeof s.motion!=='boolean') return null;
    for(const mode of ['live','demo'] as const){
      const p=s[mode];
      if(!obj(p) || !['score','streak','bestStreak','wins','losses','bossHp','bosses','algorithmWins','algorithmRounds'].every(k=>uint(p[k]))
        || Number(p.bossHp)<20 || Number(p.bossHp)>100 || Number(p.bossHp)%20!==0 || typeof p.lastMessage!=='string'
        || !Array.isArray(p.history) || p.history.length>100 || !(p.active===null || validRound(p.active,mode))) return null;
      for(const h of p.history){
        if(!validRound(h,mode) || !obj(h) || !['correct','incorrect','void'].includes(String(h.result))
          || !uint(h.points) || !uint(h.bonus) || !uint(h.settledAt) || typeof h.reason!=='string'
          || !(h.actual===null || uint(h.actual)) || !(h.evidence===null || validWindow(h.evidence))
          || !(h.algorithmCorrect===null || typeof h.algorithmCorrect==='boolean')) return null;
      }
    }
    return s as unknown as Save;
  } catch { return null; }
}
