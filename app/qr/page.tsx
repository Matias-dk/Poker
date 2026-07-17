"use client";

// QR-koder til dealerne: én stor kode pr. bord, der åbner bordets
// dealer-side. Vis siden på storskærmen eller print den (Ctrl/Cmd+P)
// og læg et kort på hvert bord.

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import Logo from "@/components/Logo";
import { useTournament } from "@/lib/store";

export default function QrPage() {
  const s = useTournament();

  return (
    <div className="qrpage">
      <header className="qrpage-header">
        <Logo size={48} />
        <div>
          <h1 className="goldtext">{s.title}</h1>
          <div className="sub">
            Dealer QR codes — scan with the phone camera to open your table
          </div>
        </div>
        <div className="spacer" />
        <button className="btn no-print" onClick={() => window.print()}>
          🖨 Print
        </button>
      </header>

      {s.tables.length === 0 && (
        <div className="hint">No tables yet — create them in the control panel first.</div>
      )}

      <div className="qr-grid">
        {s.tables.map((t) => (
          <QrCard key={t.id} tableId={t.id} name={t.name} />
        ))}
      </div>
    </div>
  );
}

function QrCard({ tableId, name }: { tableId: string; name: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [url, setUrl] = useState("");

  useEffect(() => {
    const fullUrl = `${window.location.origin}/table/${tableId}`;
    setUrl(fullUrl);
    QRCode.toDataURL(fullUrl, { width: 480, margin: 2 })
      .then(setSrc)
      .catch(() => setSrc(null));
  }, [tableId]);

  return (
    <div className="qr-card">
      <div className="qr-name">{name}</div>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={`QR code for ${name}`} />
      ) : (
        <div className="qr-loading">…</div>
      )}
      <div className="qr-url">{url.replace(/^https?:\/\//, "")}</div>
    </div>
  );
}
