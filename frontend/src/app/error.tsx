"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="rounded-xl border border-danger/25 bg-surface p-6">
      <h1 className="text-xl font-semibold">Không thể tải trang</h1>
      <p className="mt-2 text-muted">Hãy thử lại sau một lúc.</p>
      <button type="button" onClick={reset} className="mt-4 rounded-lg bg-accent-strong px-4 py-2 text-white">Thử lại</button>
    </div>
  );
}
