import { useRef, useState } from 'react';
import { toPng } from 'html-to-image';

/**
 * Wraps any content in a branded poster frame sized for a good WhatsApp
 * thumbnail (portrait-ish, generous padding — screenshots of dense app UI
 * compress badly in chat previews, so this renders a clean purpose-built
 * layout instead).
 */
export default function ShareCard({ tournamentName, title, subtitle, children }) {
  const nodeRef = useRef(null);
  const [busy, setBusy] = useState(false);

  async function handleShare() {
    if (!nodeRef.current) return;
    setBusy(true);
    try {
      const dataUrl = await toPng(nodeRef.current, { pixelRatio: 2, backgroundColor: '#0e1712' });
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `${title.replace(/\s+/g, '-').toLowerCase()}.png`, { type: 'image/png' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: `${tournamentName} — ${title}` });
      } else {
        // Fallback for browsers without file sharing: download the image, then
        // open WhatsApp so the person can attach it manually.
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = file.name;
        link.click();
        window.open('https://wa.me/', '_blank');
      }
    } catch (err) {
      console.error('Share failed', err);
      alert("Couldn't generate the image. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div
        ref={nodeRef}
        style={{
          background: 'var(--bg)',
          border: '1px solid var(--line)',
          borderRadius: 20,
          padding: '28px 24px',
          width: 420,
          maxWidth: '100%',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
          <span className="eyebrow">{tournamentName}</span>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--amber)', fontSize: 14 }}>
            FOOTBALLHUB
          </span>
        </div>
        <h3 style={{ fontSize: 22, marginBottom: subtitle ? 2 : 16 }}>{title}</h3>
        {subtitle && <p style={{ marginBottom: 16, fontSize: 13 }}>{subtitle}</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{children}</div>
      </div>

      <button className="btn btn-primary" style={{ marginTop: 12, width: '100%' }} onClick={handleShare} disabled={busy}>
        {busy ? 'Preparing image…' : 'Share to WhatsApp'}
      </button>
    </div>
  );
}
