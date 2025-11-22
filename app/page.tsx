export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <main className="container flex flex-col items-center justify-center gap-12 px-4 py-16">
        <div className="flex flex-col items-center gap-4 text-center">
          <h1 className="text-5xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50 sm:text-[5rem]">
            <span className="text-primary">SMGE</span>
          </h1>
          <h2 className="text-2xl font-semibold text-slate-700 dark:text-slate-300">
            AI-Powered Social Media Growth Engine
          </h2>
          <p className="max-w-2xl text-lg text-slate-600 dark:text-slate-400">
            Enterprise-grade social media automation platform powered by
            multi-agent AI. Transform your social media presence with
            intelligent content creation, scheduling, and analytics.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-50">
              Multi-Agent AI
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Specialized AI agents for content creation, scheduling, and
              analytics
            </p>
          </div>

          <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-50">
              Brand Brain
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Centralized brand intelligence that learns your voice and style
            </p>
          </div>

          <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-50">
              Cross-Platform
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Manage Instagram, Twitter, LinkedIn, and TikTok from one dashboard
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-sm text-slate-500 dark:text-slate-500">
            Status: Development Mode
          </p>
          <a
            href="/api/health"
            className="text-sm text-primary hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Check API Health →
          </a>
        </div>
      </main>
    </div>
  );
}
