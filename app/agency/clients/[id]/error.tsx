'use client';

export default function ClientDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 space-y-4">
        <h2 className="text-red-700 font-bold text-lg">Dashboard Error — Debug Info</h2>
        <div>
          <p className="text-xs font-semibold text-red-600 mb-1">Message:</p>
          <pre className="text-xs bg-white border border-red-100 rounded p-3 overflow-auto whitespace-pre-wrap">{error.message}</pre>
        </div>
        <div>
          <p className="text-xs font-semibold text-red-600 mb-1">Stack trace:</p>
          <pre className="text-xs bg-white border border-red-100 rounded p-3 overflow-auto whitespace-pre-wrap max-h-96">{error.stack}</pre>
        </div>
        {error.digest && (
          <p className="text-xs text-red-500">Digest: {error.digest}</p>
        )}
        <button
          onClick={reset}
          className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    </div>
  );
}
