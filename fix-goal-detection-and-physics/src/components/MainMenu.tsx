import { useMemo, useState } from 'react';
import {
  BarChart3, Check, ChevronRight, Gamepad2, Globe2, Play, Settings2, Shield, Sparkles, Trash2, Trophy,
} from 'lucide-react';
import {
  CameraPreset, CareerStats, CompetitionId, Difficulty, MatchHistoryEntry, MouseControl, PassMode,
  Quality, SeasonState, Settings, StadiumId, Strictness, Team, WorldCupState,
} from '../types/game';
import { CAMERA_PRESETS } from '../game/camera';
import { COMPETITIONS, ISL_TEAMS, KSL_TEAMS, UCL_TEAMS, getTeam } from '../data/teams';
import { NATIONS } from '../data/nations';
import { STADIUMS } from './PitchRenderer';
import { Crest } from './Crest';
import { sound } from '../utils/sound';

interface MainMenuProps {
  settings: Settings;
  career: CareerStats;
  history: MatchHistoryEntry[];
  seasons: Partial<Record<CompetitionId, SeasonState>>;
  worldCup: WorldCupState | null;
  saveWorks: boolean;
  onUpdateSettings: (settings: Settings) => void;
  onOpenCompetition: (id: CompetitionId) => void;
  onOpenWorldCup: () => void;
  onStartFriendly: (userTeam: Team, cpuTeam: Team) => void;
  onResetSave: () => void;
}

type View = 'HOME' | 'FRIENDLY' | 'SETTINGS' | 'STATS';
type Pool = 'NATIONAL' | 'ISL' | 'KSL' | 'UCL';

const POOLS: Record<Pool, Team[]> = {
  NATIONAL: NATIONS,
  ISL: ISL_TEAMS,
  KSL: KSL_TEAMS,
  UCL: UCL_TEAMS,
};

export function MainMenu(props: MainMenuProps) {
  const [view, setView] = useState<View>('HOME');

  return (
    <div className="relative min-h-[100dvh] overflow-x-hidden bg-[#04070f] text-white">
      <div className="pointer-events-none absolute inset-0 opacity-40 menu-pitch" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_75%_20%,rgba(16,185,129,.22),transparent_38%),linear-gradient(180deg,rgba(4,7,15,.72),rgba(4,7,15,.97))]" />

      <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-6xl flex-col px-4 py-5 sm:px-8">
        <header className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
          <button onClick={() => setView('HOME')} className="flex items-center gap-3 text-left">
            <span className="grid size-11 place-items-center rounded-lg bg-emerald-400 text-slate-950 shadow-[0_0_30px_rgba(52,211,153,.35)]">
              <Trophy className="size-5" />
            </span>
            <span>
              <span className="block text-[9px] font-black uppercase tracking-[.34em] text-emerald-400">Arena Edition</span>
              <span className="block text-lg font-black leading-none tracking-tight sm:text-xl">PRO FOOTBALL 3D</span>
            </span>
          </button>
          <nav className="flex items-center gap-1">
            <TopTab active={view === 'HOME'} onClick={() => setView('HOME')} icon={<Gamepad2 className="size-3.5" />} label="Play" />
            <TopTab active={view === 'STATS'} onClick={() => setView('STATS')} icon={<BarChart3 className="size-3.5" />} label="Stats" />
            <TopTab active={view === 'SETTINGS'} onClick={() => setView('SETTINGS')} icon={<Settings2 className="size-3.5" />} label="Settings" />
          </nav>
        </header>

        {view === 'HOME' && <Home {...props} onFriendly={() => setView('FRIENDLY')} />}
        {view === 'FRIENDLY' && <FriendlySetup onStart={props.onStartFriendly} onBack={() => setView('HOME')} />}
        {view === 'SETTINGS' && (
          <SettingsPanel settings={props.settings} onChange={props.onUpdateSettings} onReset={props.onResetSave} saveWorks={props.saveWorks} />
        )}
        {view === 'STATS' && <StatsPanel career={props.career} history={props.history} />}
      </div>
    </div>
  );
}

function Home({
  seasons, worldCup, onOpenCompetition, onOpenWorldCup, onFriendly, settings,
}: MainMenuProps & { onFriendly: () => void }) {
  return (
    <section className="flex-1 py-7">
      <p className="text-[10px] font-black uppercase tracking-[.3em] text-amber-300">Three competitions · one engine</p>
      <h1 className="mt-2 max-w-2xl text-4xl font-black leading-[.92] tracking-[-.05em] sm:text-6xl">
        Play the season.
        <span className="block text-emerald-400">Lift the trophy.</span>
      </h1>
      <p className="mt-4 max-w-xl text-sm leading-6 text-slate-400">
        Control one footballer, let your teammates run the channels, and take your club through a full
        campaign. Results, tables and knockout progress are saved on this device.
      </p>

      <button
        onClick={() => { sound.playUi(); onOpenWorldCup(); }}
        className="group relative mt-7 flex w-full items-center justify-between overflow-hidden rounded-xl border border-amber-400/30 bg-gradient-to-r from-amber-400/15 via-amber-400/5 to-transparent p-4 text-left transition hover:-translate-y-0.5 hover:border-amber-300/60"
      >
        <span className="flex items-center gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-amber-400 text-slate-950">
            <Trophy className="size-6" />
          </span>
          <span>
            <span className="block text-[9px] font-black uppercase tracking-[.26em] text-amber-300">Featured mode</span>
            <span className="block text-base font-black leading-tight">FIFA World Cup 2026</span>
            <span className="mt-0.5 block text-[11px] text-slate-400">
              48 nations · 12 groups · 104 matches · official fixture numbers
            </span>
          </span>
        </span>
        <span className="flex items-center gap-3">
          <span className="hidden text-right sm:block">
            <span className="block text-[9px] font-black uppercase tracking-wider text-slate-500">Status</span>
            <span className="block text-[11px] font-black text-emerald-400">
              {worldCup
                ? (worldCup.champion ? 'Completed' : `${worldCup.fixtures.filter((f) => f.played).length}/104 played`)
                : 'Not started'}
            </span>
          </span>
          <ChevronRight className="size-5 text-amber-300 transition group-hover:translate-x-1" />
        </span>
      </button>

      <div className="mt-3 grid gap-3 md:grid-cols-3">
        {(Object.keys(COMPETITIONS) as CompetitionId[]).map((id) => {
          const meta = COMPETITIONS[id];
          const season = seasons[id];
          const played = season ? season.fixtures.filter((f) => f.played).length : 0;
          return (
            <button
              key={id}
              onClick={() => { sound.playUi(); onOpenCompetition(id); }}
              className="group relative overflow-hidden rounded-xl border border-white/10 bg-white/[.03] p-4 text-left transition hover:-translate-y-0.5 hover:border-emerald-400/50 hover:bg-white/[.06]"
            >
              <div className="absolute right-0 top-0 size-24 rounded-full blur-3xl" style={{ background: meta.accentSoft }} />
              <div className="relative flex items-start justify-between">
                <span className="rounded px-2 py-1 text-[9px] font-black uppercase tracking-[.2em]" style={{ background: meta.accentSoft, color: meta.accent }}>
                  {meta.shortName}
                </span>
                <ChevronRight className="size-4 text-slate-600 transition group-hover:translate-x-1 group-hover:text-emerald-400" />
              </div>
              <h3 className="relative mt-3 text-base font-black leading-tight">{meta.name}</h3>
              <p className="relative mt-1.5 text-[11px] leading-5 text-slate-400">{meta.blurb}</p>
              <div className="relative mt-3 flex items-center justify-between text-[10px] font-bold">
                <span className="text-slate-500">{meta.teams.length} clubs</span>
                <span className={season ? 'text-emerald-400' : 'text-slate-500'}>
                  {season ? (season.champion ? 'Season complete' : `${played}/${season.fixtures.length} played`) : 'New season'}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <button
          onClick={() => { sound.playUi(); onFriendly(); }}
          className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[.03] p-4 text-left transition hover:border-emerald-400/50 hover:bg-white/[.06]"
        >
          <span className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-lg bg-emerald-400/15 text-emerald-400"><Play className="size-4" /></span>
            <span>
              <span className="block text-sm font-black">Friendly match</span>
              <span className="block text-[11px] text-slate-400">Club or national sides · never affects league tables</span>
            </span>
          </span>
          <ChevronRight className="size-4 text-slate-600" />
        </button>

        <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[.03] p-4">
          <span className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-lg bg-amber-400/15 text-amber-300"><Sparkles className="size-4" /></span>
            <span>
              <span className="block text-sm font-black">Difficulty: {settings.difficulty}</span>
              <span className="block text-[11px] text-slate-400">{settings.halfLengthSec}s halves · {settings.quality} graphics</span>
            </span>
          </span>
        </div>
      </div>
    </section>
  );
}

function FriendlySetup({ onStart, onBack }: { onStart: (a: Team, b: Team) => void; onBack: () => void }) {
  const [pool, setPool] = useState<Pool>('NATIONAL');
  const teams = POOLS[pool];
  const [userId, setUserId] = useState(teams[0].id);
  const [cpuId, setCpuId] = useState(teams[1].id);

  const switchPool = (next: Pool) => {
    setPool(next);
    setUserId(POOLS[next][0].id);
    setCpuId(POOLS[next][1].id);
  };

  return (
    <section className="flex-1 py-6">
      <button onClick={onBack} className="text-[11px] font-black uppercase tracking-wider text-slate-400 hover:text-white">← Back</button>
      <h2 className="mt-3 text-2xl font-black tracking-tight">Friendly match</h2>
      <p className="mt-1 text-xs text-slate-400">Exhibition fixture. Results are stored in match history only.</p>

      <div className="mt-5 flex flex-wrap gap-2">
        {(Object.keys(POOLS) as Pool[]).map((key) => (
          <button
            key={key}
            onClick={() => switchPool(key)}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-[11px] font-black uppercase tracking-wider transition ${pool === key ? 'bg-emerald-400 text-slate-950' : 'bg-white/5 text-slate-400 hover:text-white'}`}
          >
            {key === 'NATIONAL' ? <Globe2 className="size-3.5" /> : <Shield className="size-3.5" />}
            {key === 'NATIONAL' ? 'National' : key}
          </button>
        ))}
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <TeamPicker title="Your team" accent="text-emerald-400" teams={teams} selectedId={userId} blockedId={cpuId} onSelect={setUserId} />
        <TeamPicker title="CPU opponent" accent="text-rose-400" teams={teams} selectedId={cpuId} blockedId={userId} onSelect={setCpuId} />
      </div>

      <button
        onClick={() => onStart(getTeam(userId), getTeam(cpuId))}
        className="mt-5 w-full rounded-lg bg-emerald-400 py-3.5 text-xs font-black uppercase tracking-[.18em] text-slate-950 transition hover:bg-white sm:w-auto sm:px-10"
      >
        Kick off friendly
      </button>
    </section>
  );
}

export function TeamPicker({ title, accent, teams, selectedId, blockedId, onSelect }: {
  title: string; accent: string; teams: Team[]; selectedId: string; blockedId?: string; onSelect: (id: string) => void;
}) {
  return (
    <div>
      <p className={`mb-2 text-[10px] font-black uppercase tracking-[.2em] ${accent}`}>{title}</p>
      <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
        {teams.map((team) => {
          const active = team.id === selectedId;
          const blocked = team.id === blockedId;
          return (
            <button
              key={team.id}
              disabled={blocked}
              onClick={() => onSelect(team.id)}
              className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition ${active ? 'border-emerald-400 bg-emerald-400/10' : 'border-white/5 bg-white/[.02] hover:border-white/20'} ${blocked ? 'cursor-not-allowed opacity-25' : ''}`}
            >
              {team.flag
                ? <span className="w-7 shrink-0 text-center text-xl leading-none">{team.flag}</span>
                : <Crest team={team} size={28} />}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-extrabold">{team.name}</span>
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">{team.city} · OVR {team.rating}</span>
              </span>
              {active && <Check className="size-4 text-emerald-400" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SettingsPanel({ settings, onChange, onReset, saveWorks }: {
  settings: Settings; onChange: (s: Settings) => void; onReset: () => void; saveWorks: boolean;
}) {
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => onChange({ ...settings, [key]: value });

  return (
    <section className="flex-1 py-6">
      <h2 className="text-2xl font-black tracking-tight">Settings</h2>
      <p className="mt-1 text-xs text-slate-400">
        {saveWorks ? 'Preferences and seasons are saved on this device.' : 'Storage is unavailable, so progress will not persist.'}
      </p>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <Card
          title="Difficulty"
          hint={
            settings.difficulty === 'EASY'
              ? 'Easy: opponents think slowly before passing, misplace passes, and only one of them presses you at a time.'
              : settings.difficulty === 'NORMAL'
              ? 'Normal: balanced passing and reactions, up to two players press the ball.'
              : 'Hard: quick passing, tight pressing and accurate finishing.'
          }
        >
          <Segmented
            options={['EASY', 'NORMAL', 'HARD'] as Difficulty[]}
            value={settings.difficulty}
            onChange={(v) => set('difficulty', v)}
          />
        </Card>

        <Card title="Half length" hint="Total match time is two halves.">
          <Segmented
            options={[30, 60, 90, 120]}
            value={settings.halfLengthSec}
            format={(v) => `${v}s`}
            onChange={(v) => set('halfLengthSec', v)}
          />
        </Card>

        <Card title="Graphics quality" hint="Lower settings disable crowd and lighting effects for weaker devices.">
          <Segmented
            options={['LOW', 'MEDIUM', 'HIGH'] as Quality[]}
            value={settings.quality}
            onChange={(v) => set('quality', v)}
          />
        </Card>

        <Card title="Camera preset" hint="The camera follows your player around a full-size pitch; only part of the ground is ever on screen.">
          <Segmented
            options={['DYNAMIC_WIDE', 'STADIUM', 'PLAYER_FOLLOW', 'CUSTOM'] as CameraPreset[]}
            value={settings.cameraPreset}
            format={(v) => CAMERA_PRESETS[v].label.split(' ')[0]}
            onChange={(v) => set('cameraPreset', v)}
          />
        </Card>

        <Card title="Camera zoom" hint="Fine-tunes the preset. Dynamic zoom still reacts to the play.">
          <Segmented
            options={[0.85, 1, 1.18]}
            value={settings.cameraZoom}
            format={(v) => (v === 0.85 ? 'Wider' : v === 1 ? 'Normal' : 'Closer')}
            onChange={(v) => set('cameraZoom', v)}
          />
        </Card>

        <Card title="Camera follow speed" hint="How quickly the camera catches up. Cinematic drifts slowly behind the play.">
          <Segmented
            options={[0.45, 0.75, 1.15, 1.7]}
            value={settings.cameraSmoothness}
            format={(v) => (v === 0.45 ? 'Cinematic' : v === 0.75 ? 'Slow' : v === 1.15 ? 'Normal' : 'Fast')}
            onChange={(v) => set('cameraSmoothness', v)}
          />
        </Card>

        {settings.cameraPreset === 'CUSTOM' && (
          <Card title="Custom camera rig" hint="Height raises the view; distance pulls the camera back behind the action.">
            <Segmented
              options={[640, 840, 1040]}
              value={settings.cameraHeight}
              format={(v) => (v === 640 ? 'Low' : v === 840 ? 'Mid' : 'High')}
              onChange={(v) => set('cameraHeight', v)}
            />
            <div className="mt-2">
              <Segmented
                options={[280, 360, 460]}
                value={settings.cameraDistance}
                format={(v) => (v === 280 ? 'Near' : v === 360 ? 'Standard' : 'Far')}
                onChange={(v) => set('cameraDistance', v)}
              />
            </div>
          </Card>
        )}

        <Card title="Audio" hint="Crowd ambience and match sound effects.">
          <div className="flex gap-2">
            <Toggle label="Sound effects" value={settings.sfx} onChange={(v) => set('sfx', v)} />
            <Toggle label="Crowd" value={settings.crowd} onChange={(v) => set('crowd', v)} />
          </div>
        </Card>

        <Card title="Player switching" hint="When on, passing hands control to the receiver.">
          <Toggle label="Auto switch on pass" value={settings.autoSwitch} onChange={(v) => set('autoSwitch', v)} />
        </Card>

        <Card title="Passing" hint="Assisted passes steer onto the chosen teammate. Manual passes follow the direction you are facing.">
          <Segmented
            options={['ASSISTED', 'MANUAL'] as PassMode[]}
            value={settings.passMode}
            onChange={(v) => set('passMode', v)}
          />
        </Card>

        <Card
          title="Mouse control"
          hint={
            settings.mouseControl === 'MOTION'
              ? 'Move the cursor over the pitch and your player runs that way. No clicking or dragging needed.'
              : settings.mouseControl === 'DRAG'
              ? 'Hold the left button and drag to steer, like a virtual stick.'
              : 'Mouse steering off. Use the arrow keys or WASD.'
          }
        >
          <Segmented
            options={['MOTION', 'DRAG', 'OFF'] as MouseControl[]}
            value={settings.mouseControl}
            format={(v) => (v === 'MOTION' ? 'Cursor' : v === 'DRAG' ? 'Drag' : 'Off')}
            onChange={(v) => set('mouseControl', v)}
          />
        </Card>

        <Card title="Referee strictness" hint="Controls how often mistimed tackles are punished and carded.">
          <Segmented
            options={['LENIENT', 'STANDARD', 'STRICT'] as Strictness[]}
            value={settings.strictness}
            onChange={(v) => set('strictness', v)}
          />
        </Card>

        <Card title="Stadium" hint={STADIUMS[settings.stadium].blurb}>
          <Segmented
            options={['ARENA', 'COASTAL', 'HIGHLAND', 'NATIONAL'] as StadiumId[]}
            value={settings.stadium}
            format={(v) => STADIUMS[v].name.split(' ')[0]}
            onChange={(v) => set('stadium', v)}
          />
        </Card>
      </div>

      <div className="mt-5 rounded-xl border border-white/10 bg-white/[.03] p-4">
        <p className="text-xs font-black uppercase tracking-wider text-slate-300">Controls</p>
        <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-white/10 bg-white/10 sm:grid-cols-3">
          {[['Move the cursor', 'Run that way (no clicking)'], ['Shift + move cursor', 'Sprint — fastest on the pitch'], ['Caps Lock / C', 'Auto defensive pressure'], ['Arrows / WASD', 'Move (alternative)'], ['Space', 'Pass'], ['J', 'Shoot'], ['K', 'Tackle'], ['Tab', 'Switch player'], ['T', 'Tactics'], ['Esc', 'Pause'], ['Right click', 'Shoot']].map(([k, a]) => (
            <div key={k} className="bg-[#0a1120] px-3 py-2">
              <p className="text-[9px] font-black uppercase tracking-wider text-emerald-400">{k}</p>
              <p className="text-[11px] font-bold text-slate-300">{a}</p>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={onReset}
        className="mt-5 flex items-center gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-2.5 text-[11px] font-black uppercase tracking-wider text-rose-300 transition hover:bg-rose-500/20"
      >
        <Trash2 className="size-3.5" /> Delete all saved seasons
      </button>
    </section>
  );
}

function StatsPanel({ career, history }: { career: CareerStats; history: MatchHistoryEntry[] }) {
  const winRate = career.played ? Math.round((career.won / career.played) * 100) : 0;
  const cards = useMemo(() => ([
    ['Matches', career.played], ['Won', career.won], ['Drawn', career.drawn], ['Lost', career.lost],
    ['Goals for', career.goalsFor], ['Goals against', career.goalsAgainst], ['Win rate', `${winRate}%`], ['Trophies', career.trophies.length],
  ] as [string, string | number][]), [career, winRate]);

  return (
    <section className="flex-1 py-6">
      <h2 className="text-2xl font-black tracking-tight">Statistics</h2>
      <p className="mt-1 text-xs text-slate-400">Every match you play yourself is recorded here.</p>

      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {cards.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-white/10 bg-white/[.03] px-4 py-3">
            <p className="text-[9px] font-black uppercase tracking-wider text-slate-500">{label}</p>
            <p className="mt-1 text-xl font-black text-emerald-400">{value}</p>
          </div>
        ))}
      </div>

      {career.trophies.length > 0 && (
        <div className="mt-5 rounded-xl border border-amber-400/25 bg-amber-400/5 p-4">
          <p className="text-[10px] font-black uppercase tracking-wider text-amber-300">Trophy cabinet</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {career.trophies.map((trophy, index) => (
              <span key={`${trophy}-${index}`} className="flex items-center gap-1.5 rounded-full bg-amber-400/15 px-3 py-1 text-[11px] font-black text-amber-200">
                <Trophy className="size-3" /> {trophy}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-5">
        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Match history</p>
        <div className="mt-2 space-y-1">
          {history.length === 0 && <p className="rounded-lg bg-white/[.03] px-4 py-6 text-center text-xs text-slate-500">No matches played yet.</p>}
          {history.map((entry) => (
            <div key={entry.id} className="flex items-center justify-between rounded-lg bg-white/[.03] px-3 py-2 text-[11px]">
              <span className="w-14 font-black uppercase text-slate-500">{entry.competition}</span>
              <span className="flex-1 truncate text-right font-bold">{entry.homeName}</span>
              <span className="mx-3 font-black tabular-nums">{entry.homeGoals} - {entry.awayGoals}</span>
              <span className="flex-1 truncate font-bold">{entry.awayName}</span>
              {entry.pens && <span className="ml-2 text-[9px] font-black text-amber-300">{entry.pens}</span>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TopTab({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-black uppercase tracking-wider transition ${active ? 'bg-white text-slate-950' : 'text-slate-400 hover:text-white'}`}
    >
      {icon}<span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function Card({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[.03] p-4">
      <p className="text-xs font-black uppercase tracking-wider text-slate-200">{title}</p>
      <p className="mt-1 text-[11px] leading-5 text-slate-500">{hint}</p>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Segmented<T extends string | number>({ options, value, onChange, format }: {
  options: T[]; value: T; onChange: (value: T) => void; format?: (value: T) => string;
}) {
  return (
    <div className="flex gap-1 rounded-lg bg-black/40 p-1">
      {options.map((option) => (
        <button
          key={String(option)}
          onClick={() => { sound.playUi(); onChange(option); }}
          className={`flex-1 rounded-md px-2 py-2 text-[10px] font-black uppercase tracking-wider transition ${option === value ? 'bg-emerald-400 text-slate-950' : 'text-slate-400 hover:text-white'}`}
        >
          {format ? format(option) : String(option)}
        </button>
      ))}
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`flex flex-1 items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-[11px] font-black uppercase tracking-wider transition ${value ? 'bg-emerald-400/15 text-emerald-300' : 'bg-black/40 text-slate-500'}`}
    >
      {label}
      <span className={`h-4 w-8 rounded-full p-0.5 transition ${value ? 'bg-emerald-400' : 'bg-slate-700'}`}>
        <span className={`block size-3 rounded-full bg-white transition ${value ? 'translate-x-4' : ''}`} />
      </span>
    </button>
  );
}
