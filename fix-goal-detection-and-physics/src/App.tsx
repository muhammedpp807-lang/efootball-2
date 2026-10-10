import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppSave, CompetitionId, Fixture, MatchHistoryEntry, SeasonState, Settings, Team, WCFixture,
} from './types/game';
import { COMPETITIONS, getTeam } from './data/teams';
import './data/nations';
import { advanceSeason, applyResult, createSeason, simulateRound, stageLabel } from './game/season';
import {
  applyWCResult, createWorldCup, resolveBracket, simulateSingle, simulateUpToUserMatch,
} from './game/worldcup';
import { WC_STAGE_LABEL } from './data/wcSchedule';
import { EMPTY_SAVE, loadSave, persist, clearSave } from './game/storage';
import { cpuTactics as makeCpuTactics, validateTactics } from './game/tactics';
import { MainMenu } from './components/MainMenu';
import { CompetitionHub } from './components/CompetitionHub';
import { WorldCupHub } from './components/WorldCupHub';
import { MatchScreen, MatchResult } from './components/MatchScreen';
import { sound } from './utils/sound';

type Screen =
  | { kind: 'MENU' }
  | { kind: 'HUB'; competitionId: CompetitionId }
  | { kind: 'WC' }
  | { kind: 'MATCH' };

interface PendingMatch {
  key: string;
  userTeam: Team;
  cpuTeam: Team;
  label: string;
  matchNumberLabel: string;
  official: boolean;
  knockout: boolean;
  competitionId?: CompetitionId;
  fixtureId?: string;
  wcMatchNo?: number;
  userIsHome: boolean;
  returnTo: Screen;
}

export default function App() {
  const [save, setSave] = useState<AppSave>(EMPTY_SAVE);
  const [screen, setScreen] = useState<Screen>({ kind: 'MENU' });
  const [pending, setPending] = useState<PendingMatch | null>(null);
  const [saveWorks, setSaveWorks] = useState(true);
  const loaded = useRef(false);

  useEffect(() => {
    setSave(loadSave());
    loaded.current = true;
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    setSaveWorks(persist(save));
  }, [save]);

  useEffect(() => {
    sound.setSfx(save.settings.sfx);
    sound.setCrowd(save.settings.crowd);
  }, [save.settings.sfx, save.settings.crowd]);

  const updateSettings = useCallback((settings: Settings) => {
    setSave((prev) => ({ ...prev, settings }));
  }, []);

  const setSeason = useCallback((competitionId: CompetitionId, season: SeasonState) => {
    setSave((prev) => ({ ...prev, seasons: { ...prev.seasons, [competitionId]: season } }));
  }, []);

  const recordHistory = useCallback(
    (entry: MatchHistoryEntry, userGoals: number, cpuGoals: number, trophy?: string) => {
      setSave((prev) => ({
        ...prev,
        history: [entry, ...prev.history].slice(0, 40),
        career: {
          played: prev.career.played + 1,
          won: prev.career.won + (userGoals > cpuGoals ? 1 : 0),
          drawn: prev.career.drawn + (userGoals === cpuGoals ? 1 : 0),
          lost: prev.career.lost + (userGoals < cpuGoals ? 1 : 0),
          goalsFor: prev.career.goalsFor + userGoals,
          goalsAgainst: prev.career.goalsAgainst + cpuGoals,
          trophies: trophy && !prev.career.trophies.includes(trophy)
            ? [...prev.career.trophies, trophy]
            : prev.career.trophies,
        },
      }));
    },
    []
  );

  /* ---------------------- league competitions ---------------------- */
  const startFixture = useCallback((competitionId: CompetitionId, season: SeasonState, fixture: Fixture) => {
    const userIsHome = fixture.homeId === season.userTeamId;
    const index = season.fixtures.filter((f) => f.userMatch).findIndex((f) => f.id === fixture.id);
    setPending({
      key: `${fixture.id}-${Date.now()}`,
      userTeam: getTeam(userIsHome ? fixture.homeId : fixture.awayId),
      cpuTeam: getTeam(userIsHome ? fixture.awayId : fixture.homeId),
      label: `${COMPETITIONS[competitionId].shortName} · ${stageLabel(fixture.stage, fixture.round)}`,
      matchNumberLabel: `Game ${index + 1}`,
      official: false,
      knockout: fixture.stage !== 'LEAGUE',
      competitionId,
      fixtureId: fixture.id,
      userIsHome,
      returnTo: { kind: 'HUB', competitionId },
    });
    setScreen({ kind: 'MATCH' });
  }, []);

  const handleSimulateRound = useCallback((competitionId: CompetitionId) => {
    const season = save.seasons[competitionId];
    if (!season || season.champion) return;
    const nextUnplayed = season.fixtures.find((f) => !f.played);
    if (!nextUnplayed) return;
    setSeason(competitionId, advanceSeason(simulateRound(season, nextUnplayed.round)));
  }, [save.seasons, setSeason]);

  /* --------------------------- world cup --------------------------- */
  const startWCFixture = useCallback((fixture: WCFixture, state: import('./types/game').WorldCupState) => {
    if (!fixture.homeId || !fixture.awayId) return;
    const userIsHome = fixture.homeId === state.userTeamId;
    setPending({
      key: `wc-${fixture.matchNo}-${Date.now()}`,
      userTeam: getTeam(userIsHome ? fixture.homeId : fixture.awayId),
      cpuTeam: getTeam(userIsHome ? fixture.awayId : fixture.homeId),
      label: `World Cup · ${WC_STAGE_LABEL[fixture.stage]}${fixture.group ? ` Group ${fixture.group}` : ''} · ${fixture.venue}`,
      matchNumberLabel: `Official FIFA Match ${fixture.matchNo}`,
      official: fixture.official,
      knockout: fixture.stage !== 'GROUP',
      wcMatchNo: fixture.matchNo,
      userIsHome,
      returnTo: { kind: 'WC' },
    });
    setScreen({ kind: 'MATCH' });
  }, []);

  /* ----------------------------- result ---------------------------- */
  const handleFinish = useCallback((result: MatchResult) => {
    if (!pending) return;
    const { competitionId, fixtureId, wcMatchNo, userTeam, cpuTeam, userIsHome } = pending;
    const homeGoals = userIsHome ? result.userGoals : result.cpuGoals;
    const awayGoals = userIsHome ? result.cpuGoals : result.userGoals;
    const pens = result.pens
      ? (userIsHome ? result.pens : ([result.pens[1], result.pens[0]] as [number, number]))
      : null;

    if (competitionId && fixtureId) {
      const season = save.seasons[competitionId];
      const fixture = season?.fixtures.find((f) => f.id === fixtureId);
      if (season && fixture && !fixture.played) {
        let updated = applyResult(season, fixtureId, homeGoals, awayGoals, pens);
        updated = advanceSeason(simulateRound(updated, fixture.round, fixtureId));
        const trophy = updated.champion && updated.champion === updated.userTeamId
          ? COMPETITIONS[competitionId].trophy : undefined;
        setSeason(competitionId, updated);
        recordHistory({
          id: `${fixtureId}-${Date.now()}`,
          competition: competitionId,
          label: pending.matchNumberLabel,
          homeName: getTeam(fixture.homeId).shortName,
          awayName: getTeam(fixture.awayId).shortName,
          homeGoals, awayGoals, userWasHome: userIsHome,
          pens: result.pens ? `${result.pens[0]}-${result.pens[1]}` : undefined,
          date: Date.now(),
        }, result.userGoals, result.cpuGoals, trophy);
      }
    } else if (wcMatchNo && save.worldCup) {
      const fixture = save.worldCup.fixtures.find((f) => f.matchNo === wcMatchNo);
      if (fixture && !fixture.played) {
        let updated = applyWCResult(save.worldCup, wcMatchNo, homeGoals, awayGoals, pens);
        updated = simulateUpToUserMatch(updated);
        const trophy = updated.champion && updated.champion === updated.userTeamId
          ? 'FIFA World Cup 2026 (simulated)' : undefined;
        setSave((prev) => ({ ...prev, worldCup: updated }));
        recordHistory({
          id: `wc-${wcMatchNo}-${Date.now()}`,
          competition: 'WC',
          label: `Official FIFA Match ${wcMatchNo}`,
          homeName: getTeam(fixture.homeId as string).shortName,
          awayName: getTeam(fixture.awayId as string).shortName,
          homeGoals, awayGoals, userWasHome: userIsHome,
          pens: result.pens ? `${result.pens[0]}-${result.pens[1]}` : undefined,
          date: Date.now(),
        }, result.userGoals, result.cpuGoals, trophy);
      }
    } else {
      recordHistory({
        id: `friendly-${Date.now()}`,
        competition: 'FRIENDLY',
        homeName: userTeam.shortName,
        awayName: cpuTeam.shortName,
        homeGoals: result.userGoals,
        awayGoals: result.cpuGoals,
        userWasHome: true,
        date: Date.now(),
      }, result.userGoals, result.cpuGoals);
    }

    setScreen(pending.returnTo);
    setPending(null);
  }, [pending, save.seasons, save.worldCup, setSeason, recordHistory]);

  const activeSeason = useMemo(
    () => (screen.kind === 'HUB' ? save.seasons[screen.competitionId] ?? null : null),
    [screen, save.seasons]
  );

  /* ----------------------------- render ---------------------------- */
  if (screen.kind === 'MATCH' && pending) {
    // Load this team's own saved lineup; never carry another team's shape over.
    const userTactics = validateTactics(save.tactics[pending.userTeam.id], pending.userTeam);
    const oppTactics = makeCpuTactics(pending.cpuTeam);
    return (
      <MatchScreen
        key={pending.key}
        userTeam={pending.userTeam}
        cpuTeam={pending.cpuTeam}
        settings={save.settings}
        userTactics={userTactics}
        cpuTactics={oppTactics}
        competitionLabel={pending.label}
        matchNumberLabel={pending.matchNumberLabel}
        official={pending.official}
        knockout={pending.knockout}
        onExit={() => { setScreen(pending.returnTo); setPending(null); }}
        onFinish={handleFinish}
        onSaveTactics={(next) =>
          setSave((prev) => ({ ...prev, tactics: { ...prev.tactics, [next.teamId]: next } }))
        }
      />
    );
  }

  if (screen.kind === 'WC') {
    return (
      <WorldCupHub
        state={save.worldCup}
        onCreate={(teamId) => {
          const created = simulateUpToUserMatch(resolveBracket(createWorldCup(teamId)));
          setSave((prev) => ({ ...prev, worldCup: created }));
        }}
        onPlay={(fixture) => { if (save.worldCup) startWCFixture(fixture, save.worldCup); }}
        onSimulateToUser={() => {
          if (!save.worldCup) return;
          setSave((prev) => ({ ...prev, worldCup: simulateUpToUserMatch(prev.worldCup as import('./types/game').WorldCupState) }));
        }}
        onSimulateOne={(matchNo) => {
          if (!save.worldCup) return;
          setSave((prev) => {
            if (!prev.worldCup) return prev;
            return { ...prev, worldCup: simulateUpToUserMatch(simulateSingle(prev.worldCup, matchNo)) };
          });
        }}
        onReset={() => {
          if (!save.worldCup) return;
          const fresh = simulateUpToUserMatch(resolveBracket(createWorldCup(save.worldCup.userTeamId)));
          setSave((prev) => ({ ...prev, worldCup: fresh }));
        }}
        onBack={() => setScreen({ kind: 'MENU' })}
      />
    );
  }

  if (screen.kind === 'HUB') {
    const competitionId = screen.competitionId;
    return (
      <CompetitionHub
        competitionId={competitionId}
        season={activeSeason}
        onCreateSeason={(teamId) => setSeason(competitionId, createSeason(competitionId, teamId))}
        onPlayFixture={(fixture) => {
          const season = save.seasons[competitionId];
          if (season) startFixture(competitionId, season, fixture);
        }}
        onSimulateRound={() => handleSimulateRound(competitionId)}
        onResetSeason={() => {
          const season = save.seasons[competitionId];
          if (season) setSeason(competitionId, createSeason(competitionId, season.userTeamId));
        }}
        onBack={() => setScreen({ kind: 'MENU' })}
      />
    );
  }

  return (
    <MainMenu
      settings={save.settings}
      career={save.career}
      history={save.history}
      seasons={save.seasons}
      worldCup={save.worldCup}
      saveWorks={saveWorks}
      onUpdateSettings={updateSettings}
      onOpenCompetition={(id) => setScreen({ kind: 'HUB', competitionId: id })}
      onOpenWorldCup={() => setScreen({ kind: 'WC' })}
      onStartFriendly={(userTeam, cpuTeam) => {
        setPending({
          key: `friendly-${Date.now()}`,
          userTeam,
          cpuTeam,
          label: 'Friendly match',
          matchNumberLabel: 'Friendly · Custom fixture',
          official: false,
          knockout: false,
          userIsHome: true,
          returnTo: { kind: 'MENU' },
        });
        setScreen({ kind: 'MATCH' });
      }}
      onResetSave={() => {
        clearSave();
        setSave({ ...EMPTY_SAVE, settings: save.settings });
      }}
    />
  );
}


