import { useMemo, useState } from 'react';
import { ArrowLeft, BadgeCheck, FastForward, Play, RotateCcw, Trophy } from 'lucide-react';
import { WCFixture, WorldCupState } from '../types/game';
import { NATIONS, WC_GROUP_IDS, nationsInGroup } from '../data/nations';
import { WC_DATA_SOURCE, WC_STAGE_LABEL } from '../data/wcSchedule';
import { bestThirds, groupStageComplete, groupTable, nextUserWCFixture, qualificationLabel } from '../game/worldcup';
import { getTeam } from '../data/teams';

interface Props {
  state: WorldCupState | null;
  onCreate: (teamId: string) => void;
  onPlay: (fixture: WCFixture) => void;
  onSimulateToUser: () => void;
  onSimulateOne: (matchNo: number) => void;
  onReset: () => void;
  onBack: () => void;
}

export function WorldCupHub({ state, onCreate, onPlay, onSimulateToUser, onSimulateOne, onReset, onBack }: Props) {
  const [pick, setPick] = useState(NATIONS[0].id);
  const [tab, setTab] = useState<'GROUPS' | 'FIXTURES' | 'BRACKET'>('GROUPS');

  const upcoming = state ? nextUserWCFixture(state) : null;
  const userNation = state ? getTeam(state.userTeamId) : null;

  return (
    <div className="relative min-h-[100dvh] bg-[#04070f] text-white">
      <div className="pointer-events-none absolute inset-0 opacity-25 menu-pitch" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(4,7,15,.82),rgba(4,7,15,.98))]" />

      <div className="relative mx-auto w-full max-w-6xl px-4 py-5 sm:px-8">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="grid size-9 place-items-center rounded-lg bg-white/5 text-slate-300 transition hover:bg-white/10">
              <ArrowLeft className="size-4" />
            </button>
            <div>
              <p className="text-[9px] font-black uppercase tracking-[.3em] text-amber-300">World Cup mode</p>
              <h1 className="text-lg font-black tracking-tight sm:text-xl">2026 FIFA World Cup</h1>
            </div>
          </div>
          {state && userNation && (
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-[11px] font-black">
                <span className="text-base">{userNation.flag}</span>{userNation.name}
              </span>
              <button onClick={onReset} className="grid size-9 place-items-center rounded-lg bg-white/5 text-slate-400 transition hover:bg-rose-500/20 hover:text-rose-300" title="Restart tournament">
                <RotateCcw className="size-4" />
              </button>
            </div>
          )}
        </header>

        {!state ? (
          <section className="py-6">
            <h2 className="text-2xl font-black tracking-tight">Choose your nation</h2>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-400">
              48 teams, 12 groups, 104 matches. Top two in each group plus the eight best third-placed
              teams reach the Round of 32. You play your nation's matches; every other fixture is simulated by the game.
            </p>
            <p className="mt-2 flex items-start gap-1.5 text-[10px] leading-4 text-slate-500">
              <BadgeCheck className="mt-0.5 size-3 shrink-0 text-emerald-400" />
              {WC_DATA_SOURCE} Match results produced here are in-game simulations, not real outcomes.
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {WC_GROUP_IDS.map((group) => (
                <div key={group} className="rounded-xl border border-white/10 bg-white/[.03] p-3">
                  <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-amber-300">Group {group}</p>
                  <div className="space-y-1">
                    {nationsInGroup(group).map((nation) => (
                      <button
                        key={nation.id}
                        onClick={() => setPick(nation.id)}
                        className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition ${pick === nation.id ? 'bg-emerald-400/15 ring-1 ring-emerald-400' : 'hover:bg-white/5'}`}
                      >
                        <span className="text-base leading-none">{nation.flag}</span>
                        <span className="min-w-0 flex-1 truncate text-[11px] font-bold">{nation.name}</span>
                        <span className="text-[9px] font-black text-slate-500">{nation.rating}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => onCreate(pick)}
              className="mt-5 w-full rounded-lg bg-emerald-400 py-3.5 text-xs font-black uppercase tracking-[.18em] text-slate-950 transition hover:bg-white sm:w-auto sm:px-12"
            >
              Start tournament with {getTeam(pick).name}
            </button>
          </section>
        ) : (
          <section className="py-5">
            {state.champion && (
              <div className="mb-4 flex items-center gap-4 rounded-xl border border-amber-400/30 bg-gradient-to-r from-amber-400/15 to-transparent p-4">
                <Trophy className="size-9 text-amber-300" />
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[.2em] text-amber-300">World champions (simulated)</p>
                  <p className="text-xl font-black">{getTeam(state.champion).flag} {getTeam(state.champion).name}</p>
                  <p className="text-[11px] text-slate-400">
                    Runner-up {state.runnerUp ? getTeam(state.runnerUp).name : '—'}
                    {state.thirdPlace ? ` · Third place ${getTeam(state.thirdPlace).name}` : ''}
                  </p>
                </div>
              </div>
            )}

            {!state.champion && (
              <div className="mb-4 grid gap-3 sm:grid-cols-[1.5fr_1fr]">
                <div className="rounded-xl border border-white/10 bg-white/[.03] p-4">
                  {upcoming ? (
                    <>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded bg-emerald-400/15 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-emerald-300">
                          Official Match {upcoming.matchNo}
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          {WC_STAGE_LABEL[upcoming.stage]}{upcoming.group ? ` · Group ${upcoming.group}` : ''} · {upcoming.date} · {upcoming.venue}
                        </span>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <NationLine teamId={upcoming.homeId} />
                        <span className="text-xs font-black text-slate-500">vs</span>
                        <NationLine teamId={upcoming.awayId} reverse />
                      </div>
                      <div className="mt-4 flex gap-2">
                        <button onClick={() => onPlay(upcoming)} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-400 py-3 text-[11px] font-black uppercase tracking-wider text-slate-950 transition hover:bg-white">
                          <Play className="size-3.5" /> Play match
                        </button>
                        <button onClick={() => onSimulateOne(upcoming.matchNo)} className="flex items-center justify-center gap-2 rounded-lg bg-white/10 px-4 py-3 text-[11px] font-black uppercase tracking-wider text-slate-300 transition hover:bg-white/20">
                          <FastForward className="size-3.5" /> Simulate
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Tournament in progress</p>
                      <p className="mt-2 text-xs text-slate-400">
                        {groupStageComplete(state)
                          ? 'Your nation is out of the tournament, or the next round is still being decided.'
                          : 'Other fixtures must be played before your next match.'}
                      </p>
                      <button onClick={onSimulateToUser} className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-white/10 py-3 text-[11px] font-black uppercase tracking-wider text-slate-200 transition hover:bg-white/20">
                        <FastForward className="size-3.5" /> Advance tournament
                      </button>
                    </>
                  )}
                </div>

                <div className="rounded-xl border border-white/10 bg-white/[.03] p-4">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Progress</p>
                  <p className="mt-2 text-3xl font-black text-emerald-400">
                    {state.fixtures.filter((f) => f.played).length}
                    <span className="text-base text-slate-500">/104</span>
                  </p>
                  {userNation && (
                    <p className="mt-1 text-[11px] text-slate-400">
                      {qualificationLabel(state, state.userTeamId) ?? 'Group stage'}
                    </p>
                  )}
                  <button onClick={onSimulateToUser} className="mt-3 w-full rounded-lg bg-white/5 py-2 text-[10px] font-black uppercase tracking-wider text-slate-400 transition hover:bg-white/10">
                    Simulate other fixtures
                  </button>
                  <p className="mt-3 flex items-start gap-1.5 text-[9px] leading-3.5 text-slate-600">
                    <BadgeCheck className="mt-px size-2.5 shrink-0 text-emerald-500" />
                    Real fixture numbers, dates and venues. All scores shown are simulated in-game, not real results.
                  </p>
                </div>
              </div>
            )}

            <div className="mb-3 flex gap-1 rounded-lg bg-black/40 p-1">
              <Tab active={tab === 'GROUPS'} onClick={() => setTab('GROUPS')}>Groups</Tab>
              <Tab active={tab === 'FIXTURES'} onClick={() => setTab('FIXTURES')}>Fixtures</Tab>
              <Tab active={tab === 'BRACKET'} onClick={() => setTab('BRACKET')}>Knockouts</Tab>
            </div>

            {tab === 'GROUPS' && <Groups state={state} />}
            {tab === 'FIXTURES' && <Fixtures state={state} />}
            {tab === 'BRACKET' && <Bracket state={state} />}
          </section>
        )}
      </div>
    </div>
  );
}

function NationLine({ teamId, reverse }: { teamId: string | null; reverse?: boolean }) {
  if (!teamId) {
    return <span className="flex-1 text-[11px] font-bold text-slate-600">To be decided</span>;
  }
  const team = getTeam(teamId);
  return (
    <span className={`flex flex-1 items-center gap-2 ${reverse ? 'flex-row-reverse text-right' : ''}`}>
      <span className="text-xl leading-none">{team.flag}</span>
      <span className="min-w-0">
        <span className="block truncate text-xs font-black">{team.name}</span>
        <span className="text-[9px] font-bold uppercase text-slate-500">OVR {team.rating}</span>
      </span>
    </span>
  );
}

function Groups({ state }: { state: WorldCupState }) {
  const thirds = useMemo(
    () => (groupStageComplete(state) ? new Set(bestThirds(state).map((t) => t.teamId)) : new Set<string>()),
    [state]
  );

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {WC_GROUP_IDS.map((group) => {
        const table = groupTable(state, group);
        return (
          <div key={group} className="overflow-hidden rounded-xl border border-white/10 bg-black/30">
            <p className="border-b border-white/10 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-amber-300">Group {group}</p>
            <table className="w-full text-[11px]">
              <thead className="text-[8px] uppercase text-slate-500">
                <tr><th className="px-2 py-1.5 text-left">Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GD</th><th className="pr-2">Pts</th></tr>
              </thead>
              <tbody>
                {table.map((row, index) => {
                  const team = getTeam(row.teamId);
                  const isUser = row.teamId === state.userTeamId;
                  const qualified = index < 2 || thirds.has(row.teamId);
                  return (
                    <tr key={row.teamId} className={`border-t border-white/5 text-center ${isUser ? 'bg-emerald-400/10' : ''}`}>
                      <td className="px-2 py-1.5 text-left">
                        <span className="flex items-center gap-1.5">
                          <span className={`inline-block size-1.5 rounded-full ${qualified ? 'bg-emerald-400' : 'bg-slate-700'}`} />
                          <span className="leading-none">{team.flag}</span>
                          <span className={`truncate font-bold ${isUser ? 'text-emerald-300' : 'text-slate-200'}`}>{team.shortName}</span>
                        </span>
                      </td>
                      <td className="text-slate-400">{row.played}</td>
                      <td className="text-emerald-400">{row.won}</td>
                      <td className="text-amber-300">{row.drawn}</td>
                      <td className="text-rose-400">{row.lost}</td>
                      <td className="text-slate-400">{row.gd > 0 ? `+${row.gd}` : row.gd}</td>
                      <td className="pr-2 font-black">{row.points}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

function Fixtures({ state }: { state: WorldCupState }) {
  const byDate = useMemo(() => {
    const map = new Map<string, WCFixture[]>();
    state.fixtures.filter((f) => f.stage === 'GROUP').forEach((f) => {
      if (!map.has(f.date)) map.set(f.date, []);
      map.get(f.date)?.push(f);
    });
    return [...map.entries()];
  }, [state]);

  return (
    <div className="space-y-4">
      {byDate.map(([date, list]) => (
        <div key={date}>
          <p className="mb-1.5 text-[10px] font-black uppercase tracking-wider text-slate-500">{date}</p>
          <div className="space-y-1">
            {list.map((fixture) => <FixtureRow key={fixture.matchNo} fixture={fixture} userTeamId={state.userTeamId} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

function FixtureRow({ fixture, userTeamId }: { fixture: WCFixture; userTeamId: string }) {
  const home = fixture.homeId ? getTeam(fixture.homeId) : null;
  const away = fixture.awayId ? getTeam(fixture.awayId) : null;
  const involved = fixture.homeId === userTeamId || fixture.awayId === userTeamId;

  return (
    <div className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-[11px] ${involved ? 'bg-emerald-400/10' : 'bg-white/[.03]'}`}>
      <span className="w-9 shrink-0 text-[9px] font-black text-slate-600" title="Official FIFA match number">#{fixture.matchNo}</span>
      <span className="flex flex-1 items-center justify-end gap-1.5 truncate font-bold">
        {home ? <>{home.shortName}<span>{home.flag}</span></> : <span className="text-slate-600">TBD</span>}
      </span>
      <span className="min-w-[48px] rounded bg-black/50 px-2 py-0.5 text-center font-black tabular-nums">
        {fixture.played ? `${fixture.homeGoals}-${fixture.awayGoals}` : 'v'}
      </span>
      <span className="flex flex-1 items-center gap-1.5 truncate font-bold">
        {away ? <><span>{away.flag}</span>{away.shortName}</> : <span className="text-slate-600">TBD</span>}
      </span>
      {fixture.homePens !== null && fixture.awayPens !== null && (
        <span className="text-[9px] font-black text-amber-300">pens {fixture.homePens}-{fixture.awayPens}</span>
      )}
    </div>
  );
}

function Bracket({ state }: { state: WorldCupState }) {
  const stages: WCFixture['stage'][] = ['R32', 'R16', 'QF', 'SF', 'THIRD', 'FINAL'];
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {stages.map((stage) => {
        const list = state.fixtures.filter((f) => f.stage === stage);
        return (
          <div key={stage}>
            <p className={`mb-1.5 text-[10px] font-black uppercase tracking-wider ${stage === 'FINAL' ? 'text-amber-300' : 'text-slate-500'}`}>
              {WC_STAGE_LABEL[stage]}
            </p>
            <div className="space-y-1">
              {list.map((fixture) => <FixtureRow key={fixture.matchNo} fixture={fixture} userTeamId={state.userTeamId} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-md px-3 py-2 text-[10px] font-black uppercase tracking-wider transition ${active ? 'bg-emerald-400 text-slate-950' : 'text-slate-400 hover:text-white'}`}
    >
      {children}
    </button>
  );
}
