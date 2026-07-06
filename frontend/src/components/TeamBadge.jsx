import { colorForName, initialsForName } from '../lib/idGenerator.js';

export default function TeamBadge({ name, size = 40, fontSize }) {
  const color = colorForName(name || '?');
  const initials = initialsForName(name || '?');
  return (
    <span
      className="team-dot"
      style={{
        width: size,
        height: size,
        background: color,
        fontSize: fontSize ?? Math.round(size * 0.38),
      }}
      title={name}
    >
      {initials}
    </span>
  );
}
