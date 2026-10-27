"use client";

export function PrintButton() {
  return (
    <button type="button" className="btn btn-outline btn-sm print-hide" onClick={() => window.print()} style={{ justifySelf: "start" }}>
      Print
    </button>
  );
}
