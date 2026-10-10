import { Team } from '../types/game';

/** Original stylised crest generated from each club's colours and initials. */
export function Crest({ team, size = 40 }: { team: Team; size?: number }) {
  const initials = team.shortName.slice(0, 3);
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" className="shrink-0 drop-shadow">
      <defs>
        <linearGradient id={`g-${team.id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={team.primaryColor} />
          <stop offset="100%" stopColor={team.secondaryColor} />
        </linearGradient>
      </defs>
      <path d="M24 2 L44 8 V26 C44 36 35 43 24 46 C13 43 4 36 4 26 V8 Z" fill={`url(#g-${team.id})`} stroke="rgba(255,255,255,.55)" strokeWidth="1.6" />
      <path d="M24 2 L44 8 V26 C44 36 35 43 24 46 Z" fill="rgba(0,0,0,.16)" />
      <text
        x="24" y="30" textAnchor="middle"
        fontSize="14" fontWeight="900" fontFamily="system-ui, sans-serif"
        fill={team.primaryColor.toUpperCase() === '#FFFFFF' || team.primaryColor === '#FDE100' || team.primaryColor === '#FACC15' || team.primaryColor === '#FDE047' ? '#0f172a' : '#ffffff'}
      >
        {initials}
      </text>
    </svg>
  );
}
