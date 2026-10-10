import { useRef, useState } from 'react';
import { ArrowLeftRight, Check, Crown, Repeat, RotateCcw, X } from 'lucide-react';
import { Instruction, PlayerConfig, Team, TeamTactics } from '../types/game';
import { FORMATIONS, FORMATION_IDS, INSTRUCTIONS, PLAYSTYLES, PLAYSTYLE_IDS, instructionsForRole } from '../data/formations';
import { applyFormation, createDefaultTactics, swapPlayers } from '../game/tactics';

interface Props {
  team: Team;
  tactics: TeamTactics;
  onChange: (next: TeamTactics) => void;
  onClose: () => void;
  mode: 'PREMATCH' | 'INMATCH';
  /** In-match only: perform a real substitution on the live match. */
  onSubstitute?: (outId: string, inId: string) => boolean;
  subsUsed?: number;
  maxSubs?: number;
  onPitchIds?: string[];
}

export function TacticsBoard({
  team, tactics, onChange, onClose, mode, onSubstitute, subsUsed = 0, maxSubs = 5, onPitchIds,
}: Props) {
  const boardRef = useRef<HTMLDivElement | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [tab, setTab] = useState<'SHAPE' | 'PLAYER' | 'BENCH'>('SHAPE');
  const [note, setNote] = useState<string | null>(null);

  const squad = new Map(team.players.map((p) => [p.id, p]));
  const slots = FORMATIONS[tactics.formation];

  const nameOf = (id: string) => tactics.names[id]?.trim() || squad.get(id)?.name || '—';
  const numberOf = (id: string) => tactics.numbers[id] ?? squad.get(id)?.number ?? 0;
  const posOf = (id: string) => {
    const custom = tactics.customPositions[id];
    if (custom) return custom;
    const index = tactics.starters.indexOf(id);
    return index >= 0 ? { nx: slots[index].nx, ny: slots[index].ny } : { nx: 0.3, ny: 0 };
  };
  const roleOf = (id: string) => {
    const index = tactics.starters.indexOf(id);
    return index >= 0 ? slots[index].role : 'SUB';
  };

  const flash = (text: string) => {
    setNote(text);
    window.setTimeout(() => setNote(null), 2200);
  };

  /* ------------------------- dragging ------------------------- */
  const pointerToNorm = (clientX: number, clientY: number) => {
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const nx = (clientX - rect.left) / rect.width;
    const ny = ((clientY - rect.top) / rect.height) * 2 - 1;
    return { nx: Math.max(0.02, Math.min(0.98, nx)), ny: Math.max(-0.98, Math.min(0.98, ny)) };
  };

  const handleMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    const pos = pointerToNorm(e.clientX, e.clientY);
    if (!pos) return;
    // The goalkeeper may not be dragged out of his own penalty area.
    const isGk = roleOf(dragging) === 'GK';
    const nx = isGk ? Math.min(pos.nx, 0.16) : pos.nx;
    const ny = isGk ? Math.max(-0.4, Math.min(0.4, pos.ny)) : pos.ny;
    onChange({ ...tactics, customPositions: { ...tactics.customPositions, [dragging]: { nx, ny } } });
  };

  const handleUp = (e: React.PointerEvent) => {
    if (!dragging) { return; }
    const pos = pointerToNorm(e.clientX, e.clientY);
    if (pos) {
      // Dropping onto another marker swaps the two players.
      const other = tactics.starters.find((id) => {
        if (id === dragging) return false;
        const p = posOf(id);
        return Math.hypot(p.nx - pos.nx, (p.ny - pos.ny) * 0.5) < 0.05;
      });
      if (other) {
        const cleared = { ...tactics.customPositions };
        delete cleared[dragging];
        onChange(swapPlayers({ ...tactics, customPositions: cleared }, dragging, other));
        flash(`Swapped ${nameOf(dragging)} and ${nameOf(other)}`);
      }
    }
    setDragging(null);
  };

  const setField = <K extends keyof TeamTactics>(key: K, value: TeamTactics[K]) =>
    onChange({ ...tactics, [key]: value });

  const selectedPlayer: PlayerConfig | undefined = selected ? squad.get(selected) : undefined;

  const doSub = (outId: string, inId: string) => {
    if (mode === 'INMATCH' && onSubstitute) {
      if (subsUsed >= maxSubs) { flash('No substitutions remaining'); return; }
      const ok = onSubstitute(outId, inId);
      flash(ok ? `${nameOf(inId)} on for ${nameOf(outId)}` : 'That substitution is not allowed');
      if (ok) onChange(swapPlayers(tactics, outId, inId));
    } else {
      onChange(swapPlayers(tactics, outId, inId));
      flash(`${nameOf(inId)} into the XI`);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-2 backdrop-blur-sm sm:p-4">
      <div className="flex max-h-[96dvh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#060b16]">
        <header className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[.26em] text-emerald-400">
              {mode === 'PREMATCH' ? 'Squad & tactics' : 'In-match tactics'}
            </p>
            <h2 className="text-base font-black">{team.name}</h2>
          </div>
          <div className="flex items-center gap-2">
            {mode === 'PREMATCH' && (
              <button
                onClick={() => { onChange(createDefaultTactics(team, tactics.formation, tactics.playstyle)); flash('Lineup reset'); }}
                className="flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-2 text-[10px] font-black uppercase text-slate-300 hover:bg-white/10"
              >
                <RotateCcw className="size-3" /> Reset
              </button>
            )}
            <button onClick={onClose} className="grid size-9 place-items-center rounded-lg bg-white/5 text-slate-300 hover:bg-white/10">
              <X className="size-4" />
            </button>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto p-3 lg:grid-cols-[1.25fr_1fr]">
          {/* ------------------------- tactical pitch ------------------------- */}
          <div>
            <div
              ref={boardRef}
              onPointerMove={handleMove}
              onPointerUp={handleUp}
              onPointerLeave={() => setDragging(null)}
              className="relative aspect-[1.55/1] w-full touch-none overflow-hidden rounded-xl border border-white/10"
              style={{
                background:
                  'repeating-linear-gradient(90deg,#14823f 0 8%,#116b35 8% 16%)',
              }}
            >
              {/* markings */}
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute inset-y-0 left-1/2 w-px bg-white/55" />
                <div className="absolute left-1/2 top-1/2 size-[22%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/55" />
                <div className="absolute inset-y-[22%] left-0 w-[16%] border border-white/55" />
                <div className="absolute inset-y-[22%] right-0 w-[16%] border border-white/55" />
                <div className="absolute inset-y-[37%] left-0 w-[6%] border border-white/45" />
                <div className="absolute inset-y-[37%] right-0 w-[6%] border border-white/45" />
                <div className="absolute inset-0 border border-white/55" />
                <span className="absolute left-2 top-2 text-[9px] font-black text-white/60">OWN GOAL</span>
                <span className="absolute right-2 top-2 text-[9px] font-black text-white/60">ATTACK →</span>
              </div>

              {tactics.starters.map((id) => {
                const pos = posOf(id);
                const role = roleOf(id);
                const isCaptain = tactics.captain === id;
                const isSel = selected === id;
                return (
                  <button
                    key={id}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
                      setSelected(id);
                      setDragging(id);
                      setTab('PLAYER');
                    }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 touch-none"
                    style={{ left: `${pos.nx * 100}%`, top: `${((pos.ny + 1) / 2) * 100}%` }}
                  >
                    <span className={`flex flex-col items-center ${dragging === id ? 'scale-110' : ''} transition-transform`}>
                      <span className={`grid size-7 place-items-center rounded-full border-2 text-[10px] font-black shadow sm:size-8 ${isSel ? 'border-amber-300 bg-amber-400 text-slate-950' : 'border-white/70 bg-emerald-500 text-white'}`}>
                        {numberOf(id)}
                      </span>
                      <span className="mt-0.5 flex items-center gap-0.5 whitespace-nowrap rounded bg-black/75 px-1 py-px text-[7px] font-black text-white sm:text-[8px]">
                        {isCaptain && <Crown className="size-2 text-amber-300" />}
                        {nameOf(id).split(' ').slice(-1)[0]}
                        <span className="text-emerald-300">{role}</span>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[10px] text-slate-500">
              Drag a marker to move a player. Drop one marker on another to swap them.
            </p>
            {note && (
              <p className="mt-1 rounded bg-emerald-400/15 px-2 py-1 text-[10px] font-bold text-emerald-300">{note}</p>
            )}
          </div>

          {/* ------------------------- panels ------------------------- */}
          <div className="min-w-0">
            <div className="mb-2 flex gap-1 rounded-lg bg-black/50 p-1">
              {(['SHAPE', 'PLAYER', 'BENCH'] as const).map((t) => (
                <button key={t} onClick={() => setTab(t)}
                  className={`flex-1 rounded px-2 py-2 text-[10px] font-black uppercase tracking-wider transition ${tab === t ? 'bg-emerald-400 text-slate-950' : 'text-slate-400 hover:text-white'}`}>
                  {t === 'SHAPE' ? 'Shape' : t === 'PLAYER' ? 'Player' : 'Bench'}
                </button>
              ))}
            </div>

            {tab === 'SHAPE' && (
              <div className="space-y-3">
                <Block title="Formation">
                  <div className="grid grid-cols-4 gap-1">
                    {FORMATION_IDS.map((f) => (
                      <button key={f}
                        onClick={() => { onChange(applyFormation(tactics, team, f)); flash(`Formation ${f}`); }}
                        className={`rounded px-1 py-2 text-[10px] font-black transition ${tactics.formation === f ? 'bg-emerald-400 text-slate-950' : 'bg-white/5 text-slate-300 hover:bg-white/10'}`}>
                        {f}
                      </button>
                    ))}
                  </div>
                </Block>

                <Block title="Team playstyle">
                  <div className="space-y-1">
                    {PLAYSTYLE_IDS.map((s) => (
                      <button key={s} onClick={() => setField('playstyle', s)}
                        className={`flex w-full items-start gap-2 rounded px-2 py-1.5 text-left transition ${tactics.playstyle === s ? 'bg-emerald-400/15 ring-1 ring-emerald-400' : 'hover:bg-white/5'}`}>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[11px] font-black">{PLAYSTYLES[s].label}</span>
                          <span className="block text-[9px] leading-3 text-slate-500">{PLAYSTYLES[s].blurb}</span>
                        </span>
                        {tactics.playstyle === s && <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-400" />}
                      </button>
                    ))}
                  </div>
                </Block>

                <Block title="Mentality">
                  <Slider label="Attacking" value={tactics.mentality} onChange={(v) => setField('mentality', v)} />
                  <Slider label="Defensive line" value={tactics.defLine} onChange={(v) => setField('defLine', v)} />
                  <Slider label="Pressing" value={tactics.pressing} onChange={(v) => setField('pressing', v)} />
                </Block>
              </div>
            )}

            {tab === 'PLAYER' && (
              <div className="space-y-3">
                {!selectedPlayer ? (
                  <p className="rounded-lg bg-white/[.03] px-4 py-8 text-center text-xs text-slate-500">
                    Tap a player on the pitch to edit them.
                  </p>
                ) : (
                  <>
                    <Block title={`${roleOf(selectedPlayer.id)} · editing`}>
                      <label className="mb-2 block">
                        <span className="mb-1 block text-[9px] font-black uppercase text-slate-500">Display name</span>
                        <input
                          value={tactics.names[selectedPlayer.id] ?? selectedPlayer.name}
                          onChange={(e) => onChange({ ...tactics, names: { ...tactics.names, [selectedPlayer.id]: e.target.value } })}
                          maxLength={18}
                          className="w-full rounded bg-black/50 px-2 py-2 text-xs font-bold text-white outline-none ring-1 ring-white/10 focus:ring-emerald-400"
                        />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-[9px] font-black uppercase text-slate-500">Shirt number</span>
                        <input
                          type="number" min={1} max={99}
                          value={numberOf(selectedPlayer.id)}
                          onChange={(e) => {
                            const n = Math.max(1, Math.min(99, Number(e.target.value) || 1));
                            onChange({ ...tactics, numbers: { ...tactics.numbers, [selectedPlayer.id]: n } });
                          }}
                          className="w-24 rounded bg-black/50 px-2 py-2 text-xs font-bold text-white outline-none ring-1 ring-white/10 focus:ring-emerald-400"
                        />
                      </label>
                    </Block>

                    <Block title="Individual instruction">
                      <div className="space-y-1">
                        {instructionsForRole(roleOf(selectedPlayer.id) === 'SUB' ? 'CM' : roleOf(selectedPlayer.id) as never).map((ins: Instruction) => (
                          <button key={ins}
                            onClick={() => onChange({ ...tactics, instructions: { ...tactics.instructions, [selectedPlayer.id]: ins } })}
                            className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-[11px] font-bold transition ${(tactics.instructions[selectedPlayer.id] ?? 'BALANCED') === ins ? 'bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400' : 'text-slate-300 hover:bg-white/5'}`}>
                            {INSTRUCTIONS[ins].label}
                            {(tactics.instructions[selectedPlayer.id] ?? 'BALANCED') === ins && <Check className="size-3.5" />}
                          </button>
                        ))}
                      </div>
                    </Block>

                    <Block title="Responsibilities">
                      <div className="grid grid-cols-2 gap-1">
                        <RoleBtn active={tactics.captain === selectedPlayer.id} label="Captain" onClick={() => setField('captain', selectedPlayer.id)} />
                        <RoleBtn active={tactics.penaltyTaker === selectedPlayer.id} label="Penalties" onClick={() => setField('penaltyTaker', selectedPlayer.id)} />
                        <RoleBtn active={tactics.freeKickTaker === selectedPlayer.id} label="Free kicks" onClick={() => setField('freeKickTaker', selectedPlayer.id)} />
                        <RoleBtn active={tactics.cornerTaker === selectedPlayer.id} label="Corners" onClick={() => setField('cornerTaker', selectedPlayer.id)} />
                      </div>
                    </Block>
                  </>
                )}
              </div>
            )}

            {tab === 'BENCH' && (
              <div className="space-y-3">
                <Block title={mode === 'INMATCH' ? `Substitutions (${subsUsed}/${maxSubs} used)` : 'Substitutes'}>
                  {tactics.bench.length === 0 && <p className="text-[11px] text-slate-500">No players on the bench.</p>}
                  <div className="space-y-1">
                    {tactics.bench.map((id) => (
                      <div key={id} className="flex items-center gap-2 rounded bg-white/[.03] px-2 py-1.5">
                        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-slate-700 text-[9px] font-black">{numberOf(id)}</span>
                        <span className="min-w-0 flex-1 truncate text-[11px] font-bold">{nameOf(id)}</span>
                        <span className="text-[9px] font-black text-slate-500">{squad.get(id)?.role}</span>
                        <button
                          onClick={() => {
                            if (!selected || !tactics.starters.includes(selected)) { flash('Select a player on the pitch first'); return; }
                            doSub(selected, id);
                          }}
                          className="flex items-center gap-1 rounded bg-emerald-400/15 px-2 py-1 text-[9px] font-black uppercase text-emerald-300 hover:bg-emerald-400 hover:text-slate-950"
                        >
                          {mode === 'INMATCH' ? <Repeat className="size-3" /> : <ArrowLeftRight className="size-3" />} On
                        </button>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-[10px] text-slate-500">
                    {selected && tactics.starters.includes(selected)
                      ? `Replacing: ${nameOf(selected)}`
                      : 'Pick a player on the pitch, then press On.'}
                  </p>
                </Block>

                {onPitchIds && (
                  <Block title="On the pitch">
                    <div className="grid grid-cols-2 gap-1">
                      {tactics.starters.map((id) => (
                        <button key={id} onClick={() => setSelected(id)}
                          className={`truncate rounded px-2 py-1.5 text-left text-[10px] font-bold transition ${selected === id ? 'bg-amber-400 text-slate-950' : 'bg-white/[.03] text-slate-300 hover:bg-white/10'}`}>
                          {numberOf(id)} {nameOf(id)}
                        </button>
                      ))}
                    </div>
                  </Block>
                )}
              </div>
            )}
          </div>
        </div>

        <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-white/10 px-4 py-3">
          <p className="text-[10px] text-slate-500">
            {tactics.formation} · {PLAYSTYLES[tactics.playstyle].label}
          </p>
          <button onClick={onClose} className="rounded-lg bg-emerald-400 px-6 py-2.5 text-[11px] font-black uppercase tracking-wider text-slate-950 hover:bg-white">
            Confirm
          </button>
        </footer>
      </div>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[.03] p-3">
      <p className="mb-2 text-[9px] font-black uppercase tracking-wider text-emerald-400">{title}</p>
      {children}
    </div>
  );
}

function RoleBtn({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`rounded px-2 py-1.5 text-[10px] font-black uppercase transition ${active ? 'bg-amber-400 text-slate-950' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}>
      {label}
    </button>
  );
}

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="mb-2 block last:mb-0">
      <span className="mb-1 flex justify-between text-[9px] font-black uppercase text-slate-500">
        <span>{label}</span><span className="text-emerald-400">{value}</span>
      </span>
      <input type="range" min={0} max={100} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-emerald-400" />
    </label>
  );
}
