import { useMemo, useState } from 'react';
import { ArrowLeft, FastForward, Play, RotateCcw, Trophy } from 'lucide-react';
import { CompetitionId, Fixture, SeasonState, Stage } from '../types/game';
import { COMPETITIONS, getTeam } from '../data/teams';
import { computeStandings, nextUserFixture, stageLabel } from '../game/season';
import { Crest } from './Crest';
import { TeamPicker } from './MainMenu';

interface HubProps {
  competitionId: CompetitionId;
  season: SeasonState | null;
  onCreateSeason: (teamId: string) => void;
  onPlayFixture: (fixture: Fixture) => void;
  onSimulateRound: () => void;
  onResetSeason: () => void;
  onBack: () => void;
}

export function CompetitionHub({
  competitionId, season, onCreateSeason, onPlayFixture, onSimulateRound, onResetSeason, onBack,
}: HubProps) {
  const meta = COMPETITIONS[competitionId];
  const [pick, setPick] = useState(meta.teams[0].id);
  const [tab, setTab] = useState<'TABLE' | 'FIXTURES' | 'BRACKET'>('TABLE');

  const standings = useMemo(() => (season ? computeStandings(season) : []), [season]);
  const upcoming = season ? nextUserFixture(season) : null;
  const currentRound = useMemo(() => {
    if (!season) return 1;
    const unplayed = season.fixtures.find((f) => !f.played);
    return unplayed ? unplayed.round : season.fixtures[season.fixtures.length - 1].round;
  }, [season]);

  return (
    <div className="relative min-h-[100dvh] bg-[#04070f] text-white">
      <div className="pointer-events-none absolute inset-0 opacity-30 menu-pitch" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(4,7,15,.8),rgba(4,7,15,.98))]" />

      <div className="relative mx-auto w-full max-w-6xl px-4 py-5 sm:px-8">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="grid size-9 place-items-center rounded-lg bg-white/5 text-slate-300 transition hover:bg-white/10">
              <ArrowLeft className="size-4" />
            </button>
            <div>
              <p className="text-[9px] font-black uppercase tracking-[.3em]" style={{ color: meta.accent }}>{meta.shortName} season</p>
              <h1 className="text-lg font-black tracking-tight sm:text-xl">{meta.name}</h1>
            </div>
          </div>
          {season && (
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2">
                <Crest team={getTeam(season.userTeamId)} size={22} />
                <span className="text-[11px] font-black">{getTeam(season.userTeamId).shortName}</span>
              </span>
              <button onClick={onResetSeason} className="grid size-9 place-items-center rounded-lg bg-white/5 text-slate-400 transition hover:bg-rose-500/20 hover:text-rose-300" title="Restart season">
                <RotateCcw className="size-4" />
              </button>
            </div>
          )}
        </header>

        {!season ? (
          <section className="py-6">
            <h2 className="text-2xl font-black tracking-tight">Choose your club</h2>
            <p className="mt-1 max-w-xl text-xs text-slate-400">
              {meta.blurb} You play your own fixtures; the rest of the matchday is simulated from club ratings.
            </p>
            <div className="mt-5 max-w-md">
              <TeamPicker title="Select club" accent="text-emerald-400" teams={meta.teams} selectedId={pick} onSelect={setPick} />
            </div>
            <button
              onClick={() => onCreateSeason(pick)}
              className="mt-5 rounded-lg bg-emerald-400 px-8 py-3.5 text-xs font-black uppercase tracking-[.18em] text-slate-950 transition hover:bg-white"
            >
              Start season
            </button>
          </section>
        ) : (
          <section className="py-5">
            {season.champion && (
              <div className="mb-4 flex items-center gap-4 rounded-xl border border-amber-400/30 bg-gradient-to-r from-amber-400/15 to-transparent p-4">
                <Trophy className="size-8 text-amber-300" />
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[.2em] text-amber-300">{meta.trophy}</p>
                  <p className="text-lg font-black">{getTeam(season.champion).name}</p>
                  <p className="text-[11px] text-slate-400">
                    {season.champion === season.userTeamId ? 'You lifted the trophy.' : 'Season complete — restart to play again.'}
                  </p>
                </div>
              </div>
            )}

            {!season.champion && (
              <div className="mb-4 grid gap-3 sm:grid-cols-[1.4fr_1fr]">
                <div className="rounded-xl border border-white/10 bg-white/[.03] p-4">
                  <p className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
                    {upcoming ? `Next: ${stageLabel(upcoming.stage, upcoming.round)}` : `${stageLabel(season.stage)} in progress`}
                  </p>
                  {upcoming ? (
                    <>
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <ClubLine teamId={upcoming.homeId} />
                        <span className="text-xs font-black text-slate-500">vs</span>
                        <ClubLine teamId={upcoming.awayId} reverse />
                      </div>
                      <div className="mt-4 flex gap-2">
                        <button
                          onClick={() => onPlayFixture(upcoming)}
                          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-400 py-3 text-[11px] font-black uppercase tracking-wider text-slate-950 transition hover:bg-white"
                        >
                          <Play className="size-3.5" /> Play match
                        </button>
                        <button
                          onClick={onSimulateRound}
                          className="flex items-center justify-center gap-2 rounded-lg bg-white/10 px-4 py-3 text-[11px] font-black uppercase tracking-wider text-slate-300 transition hover:bg-white/20"
                        >
                          <FastForward className="size-3.5" /> Simulate
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="mt-2 text-xs text-slate-400">
                        You have no fixture left in this round. Simulate to move the competition forward.
                      </p>
                      <button
                        onClick={onSimulateRound}
                        className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-white/10 py-3 text-[11px] font-black uppercase tracking-wider text-slate-200 transition hover:bg-white/20"
                      >
                        <FastForward className="size-3.5" /> Simulate next round
                      </button>
                    </>
                  )}
                </div>

                <div className="rounded-xl border border-white/10 bg-white/[.03] p-4">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Season progress</p>
                  <p className="mt-2 text-3xl font-black text-emerald-400">
                    {season.fixtures.filter((f) => f.played).length}
                    <span className="text-base text-slate-500">/{season.fixtures.length}</span>
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">{stageLabel(season.stage, currentRound)}</p>
                  <p className="mt-3 text-[10px] leading-4 text-slate-600">
                    Simulated results are generated in-game from club ratings and are not real-world results.
                  </p>
                </div>
              </div>
            )}

            <div className="mb-3 flex gap-1 rounded-lg bg-black/40 p-1">
              <Tab active={tab === 'TABLE'} onClick={() => setTab('TABLE')}>Table</Tab>
              <Tab active={tab === 'FIXTURES'} onClick={() => setTab('FIXTURES')}>Fixtures</Tab>
              {meta.format === 'LEAGUE_KNOCKOUT' && <Tab active={tab === 'BRACKET'} onClick={() => setTab('BRACKET')}>Bracket</Tab>}
            </div>

            {tab === 'TABLE' && (
              <div className="overflow-x-auto rounded-xl border border-white/10 bg-black/30">
                <table className="w-full min-w-[520px] text-[11px]">
                  <thead className="text-[9px] uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-3 py-2.5 text-left">#</th>
                      <th className="px-2 py-2.5 text-left">Club</th>
                      <th className="px-2">P</th><th className="px-2">W</th><th className="px-2">D</th><th className="px-2">L</th>
                      <th className="px-2">GF</th><th className="px-2">GA</th><th className="px-2">GD</th>
                      <th className="px-3 text-right text-emerald-400">Pts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standings.map((row, index) => {
                      const team = getTeam(row.teamId);
                      const isUser = row.teamId === season.userTeamId;
                      const qualifies = meta.format === 'LEAGUE_KNOCKOUT' && index < 8;
                      return (
                        <tr key={row.teamId} className={`border-t border-white/5 text-center ${isUser ? 'bg-emerald-400/10' : ''}`}>
                          <td className="px-3 py-2.5 text-left font-mono text-slate-500">
                            <span className={qualifies ? 'text-emerald-400' : ''}>{index + 1}</span>
                          </td>
                          <td className="px-2 py-2.5 text-left">
                            <span className="flex items-center gap-2">
                              <Crest team={team} size={18} />
                              <span className={`truncate font-bold ${isUser ? 'text-emerald-300' : 'text-slate-200'}`}>{team.name}</span>
                            </span>
                          </td>
                          <td className="px-2 text-slate-300">{row.played}</td>
                          <td className="px-2 text-emerald-400">{row.won}</td>
                          <td className="px-2 text-amber-300">{row.drawn}</td>
                          <td className="px-2 text-rose-400">{row.lost}</td>
                          <td className="px-2 text-slate-300">{row.gf}</td>
                          <td className="px-2 text-slate-300">{row.ga}</td>
                          <td className="px-2 text-slate-300">{row.gd > 0 ? `+${row.gd}` : row.gd}</td>
                          <td className="px-3 text-right font-black">{row.points}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {tab === 'FIXTURES' && <FixtureList season={season} stageFilter="LEAGUE" />}
            {tab === 'BRACKET' && <Bracket season={season} />}
          </section>
        )}
      </div>
    </div>
  );
}

function ClubLine({ teamId, reverse }: { teamId: string; reverse?: boolean }) {
  const team = getTeam(teamId);
  return (
    <span className={`flex flex-1 items-center gap-2 ${reverse ? 'flex-row-reverse text-right' : ''}`}>
      <Crest team={team} size={30} />
      <span className="min-w-0">
        <span className="block truncate text-xs font-black">{team.name}</span>
        <span className="text-[9px] font-bold uppercase text-slate-500">OVR {team.rating}</span>
      </span>
    </span>
  );
}

function FixtureList({ season, stageFilter }: { season: SeasonState; stageFilter: Stage }) {
  const rounds = useMemo(() => {
    const map = new Map<number, Fixture[]>();
    season.fixtures.filter((f) => f.stage === stageFilter).forEach((f) => {
      if (!map.has(f.round)) map.set(f.round, []);
      map.get(f.round)?.push(f);
    });
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [season, stageFilter]);

  return (
    <div className="space-y-4">
      {rounds.map(([round, list]) => (
        <div key={round}>
          <p className="mb-1.5 text-[10px] font-black uppercase tracking-wider text-slate-500">Matchday {round}</p>
          <div className="space-y-1">
            {list.map((fixture) => <FixtureRow key={fixture.id} fixture={fixture} userTeamId={season.userTeamId} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

function FixtureRow({ fixture, userTeamId }: { fixture: Fixture; userTeamId: string }) {
  const home = getTeam(fixture.homeId);
  const away = getTeam(fixture.awayId);
  const involved = fixture.homeId === userTeamId || fixture.awayId === userTeamId;
  return (
    <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-[11px] ${involved ? 'bg-emerald-400/10' : 'bg-white/[.03]'}`}>
      <span className="flex flex-1 items-center justify-end gap-2 truncate font-bold">{home.shortName}<Crest team={home} size={16} /></span>
      <span className="min-w-[52px] rounded bg-black/50 px-2 py-1 text-center font-black tabular-nums">
        {fixture.played ? `${fixture.homeGoals}-${fixture.awayGoals}` : 'vs'}
      </span>
      <span className="flex flex-1 items-center gap-2 truncate font-bold"><Crest team={away} size={16} />{away.shortName}</span>
      {fixture.homePens !== null && fixture.awayPens !== null && (
        <span className="text-[9px] font-black text-amber-300">pens {fixture.homePens}-{fixture.awayPens}</span>
      )}
    </div>
  );
}

function Bracket({ season }: { season: SeasonState }) {
  const stages: Stage[] = ['QF', 'SF', 'FINAL'];
  const hasKnockout = season.fixtures.some((f) => f.stage !== 'LEAGUE');
  if (!hasKnockout) {
    return (
      <p className="rounded-xl bg-white/[.03] px-4 py-8 text-center text-xs text-slate-500">
        The bracket unlocks when the league phase is complete. The top eight clubs qualify.
      </p>
    );
  }
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {stages.map((stage) => {
        const list = season.fixtures.filter((f) => f.stage === stage);
        return (
          <div key={stage}>
            <p className="mb-1.5 text-[10px] font-black uppercase tracking-wider" style={{ color: stage === 'FINAL' ? '#fbbf24' : '#94a3b8' }}>
              {stageLabel(stage)}
            </p>
            <div className="space-y-1">
              {list.length === 0 && <p className="rounded-lg bg-white/[.03] px-3 py-4 text-center text-[11px] text-slate-600">Awaiting qualifiers</p>}
              {list.map((fixture) => <FixtureRow key={fixture.id} fixture={fixture} userTeamId={season.userTeamId} />)}
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
