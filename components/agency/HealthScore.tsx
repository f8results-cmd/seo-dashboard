import { healthColour, healthLabel } from '@/lib/health';

interface Props {
  score: number;
  size?: number;
}

export default function HealthScore({ score, size = 48 }: Props) {
  const colour = healthColour(score);
  const label = healthLabel(score);
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={5} />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke={colour}
          strokeWidth={5}
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
        />
      </svg>
      <span className="text-xs font-semibold" style={{ color: colour }}>{score}</span>
      <span className="text-[10px] text-gray-400">{label}</span>
    </div>
  );
}
