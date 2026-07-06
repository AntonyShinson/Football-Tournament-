const PRESET_COLORS = [
  '#E53935', '#D81B60', '#8E24AA', '#5E35B1', '#3949AB',
  '#1E88E5', '#039BE5', '#00ACC1', '#00897B', '#43A047',
  '#7CB342', '#C0CA33', '#FDD835', '#FFB300', '#FB8C00',
  '#F4511E', '#6D4C41', '#757575', '#212121', '#FFFFFF',
];

const SIZE = 220;
const RADIUS = 88;
const SWATCH = 34;

function polar(radius, angleDeg) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: radius * Math.cos(rad), y: radius * Math.sin(rad) };
}

/** value/onChange: hex string, e.g. "#3949AB". Pass null/'' for "no color chosen yet". */
export default function JerseyColorPicker({ value, onChange }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 13, color: 'var(--text-muted)', marginBottom: 10 }}>
        Jersey color (optional)
      </label>
      <div style={{ position: 'relative', width: SIZE, height: SIZE, margin: '0 auto' }}>
        {/* Centre preview */}
        <div
          style={{
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            width: 56, height: 56, borderRadius: '50%',
            background: value || 'var(--surface-2)',
            border: '2px solid var(--line)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {!value && <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>none</span>}
        </div>

        {PRESET_COLORS.map((color, i) => {
          const angle = (i / PRESET_COLORS.length) * 360 - 90;
          const { x, y } = polar(RADIUS, angle);
          const selected = value?.toLowerCase() === color.toLowerCase();
          return (
            <button
              key={color}
              type="button"
              onClick={() => onChange(selected ? '' : color)}
              title={color}
              aria-label={`Jersey color ${color}`}
              aria-pressed={selected}
              style={{
                position: 'absolute',
                top: `calc(50% + ${y}px - ${SWATCH / 2}px)`,
                left: `calc(50% + ${x}px - ${SWATCH / 2}px)`,
                width: SWATCH, height: SWATCH, borderRadius: '50%',
                background: color,
                border: selected ? '3px solid var(--amber)' : '2px solid var(--line)',
                boxShadow: selected ? '0 0 0 3px rgba(242,183,5,0.25)' : 'none',
                cursor: 'pointer',
                padding: 0,
              }}
            />
          );
        })}
      </div>
      {value && (
        <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
          Selected: <span className="mono">{value}</span>
        </p>
      )}
    </div>
  );
}