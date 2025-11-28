export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="flex flex-col items-center gap-4 text-center px-4">
        <h1 className="text-6xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50">
          404
        </h1>
        <h2 className="text-2xl font-semibold text-slate-700 dark:text-slate-300">
          Page Not Found
        </h2>
        <p className="max-w-md text-lg text-slate-600 dark:text-slate-400">
          The page you are looking for does not exist or has been moved.
        </p>
        <a
          href="/"
          className="mt-4 rounded-lg bg-primary px-6 py-3 text-primary-foreground hover:opacity-90 transition-opacity"
        >
          Return Home
        </a>
      </div>
    </div>
  );
}
