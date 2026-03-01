// @tier: free
'use client';

import { useEffect, useState, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { helpAPI } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { hasTierAtLeast } from '@/lib/access';

interface HelpArticle {
  slug: string;
  title: string;
  description: string;
  icon: string;
  category: string;
  locked: boolean;
  minTierRequired: string;
}

interface HelpCategories {
  [category: string]: HelpArticle[];
}

const TIER_LABELS: Record<string, string> = {
  free: 'Free',
  starter: 'Starter',
  professional: 'Professional',
  enterprise: 'Enterprise',
  utilities: 'Utilities',
};

const TIER_COLORS: Record<string, string> = {
  free: 'bg-gray-100 text-gray-700',
  starter: 'bg-blue-100 text-blue-700',
  professional: 'bg-purple-100 text-purple-700',
  enterprise: 'bg-amber-100 text-amber-700',
  utilities: 'bg-amber-100 text-amber-700',
};

// Allowed HTML tags produced by renderMarkdown — strip any others before rendering
const ALLOWED_TAGS = new Set([
  'h1','h2','h3','h4','p','pre','code','strong','em','li','blockquote',
  'a','br','hr','div','span'
]);

function sanitizeHtml(html: string): string {
  // Remove any tags not in the allow-list (regex-based, matches opening and closing tags)
  return html.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g, (match, tag) => {
    return ALLOWED_TAGS.has(tag.toLowerCase()) ? match : '';
  });
}

// Simple Markdown renderer — handles headings, bold, code blocks, bullet lists,
// and horizontal rules. No external dependency needed.
function renderMarkdown(md: string): string {
  const html = md
    // Fenced code blocks
    .replace(/```[\w]*\n([\s\S]*?)```/g, '<pre class="bg-gray-800 text-green-300 rounded p-4 overflow-x-auto text-sm my-4"><code>$1</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="bg-gray-100 text-purple-700 rounded px-1 py-0.5 text-sm font-mono">$1</code>')
    // Headings
    .replace(/^#### (.+)$/gm, '<h4 class="text-base font-semibold text-gray-800 mt-4 mb-1">$1</h4>')
    .replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold text-gray-900 mt-6 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold text-gray-900 mt-8 mb-3 border-b pb-1">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold text-gray-900 mt-6 mb-4">$1</h1>')
    // Horizontal rules
    .replace(/^---$/gm, '<hr class="my-6 border-gray-200" />')
    // Bold + italic
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Blockquote
    .replace(/^> (.+)$/gm, '<blockquote class="border-l-4 border-purple-400 pl-4 italic text-gray-600 my-2">$1</blockquote>')
    // Unordered lists (simple)
    .replace(/^[-*] (.+)$/gm, '<li class="ml-4 list-disc text-gray-700">$1</li>')
    // Ordered lists
    .replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal text-gray-700">$1</li>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-purple-600 hover:underline" target="_blank" rel="noopener noreferrer">$1</a>')
    // Paragraphs: double newlines become paragraph breaks
    .replace(/\n\n/g, '</p><p class="mb-3 text-gray-700">')
    .replace(/\n/g, '<br />');
  return sanitizeHtml(html);
}

export default function HelpPage() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<HelpCategories>({});
  const [loading, setLoading] = useState(true);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [articleContent, setArticleContent] = useState<string>('');
  const [articleTitle, setArticleTitle] = useState('');
  const [articleIcon, setArticleIcon] = useState('');
  const [articleLoading, setArticleLoading] = useState(false);
  const [articleError, setArticleError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    helpAPI.getIndex()
      .then((res: any) => setCategories(res.data?.data?.categories || {}))
      .catch(() => setCategories({}))
      .finally(() => setLoading(false));
  }, []);

  const openArticle = useCallback(async (slug: string, title: string, icon: string) => {
    setSelectedSlug(slug);
    setArticleTitle(title);
    setArticleIcon(icon);
    setArticleContent('');
    setArticleError('');
    setArticleLoading(true);
    try {
      const res = await helpAPI.getArticle(slug);
      setArticleContent(res.data?.data?.content || '');
    } catch (err: any) {
      setArticleError(err?.response?.data?.error || 'Failed to load article');
    } finally {
      setArticleLoading(false);
    }
  }, []);

  const filteredCategories: HelpCategories = searchQuery.trim()
    ? Object.fromEntries(
        (Object.entries(categories) as [string, HelpArticle[]][])
          .map(([cat, articles]) => [
            cat,
            articles.filter(
              (a) =>
                a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                a.description.toLowerCase().includes(searchQuery.toLowerCase())
            ),
          ])
          .filter(([, articles]) => (articles as HelpArticle[]).length > 0)
      )
    : categories;

  const currentTierLabel = TIER_LABELS[user?.effectiveTier || user?.organizationTier || 'free'] || 'Free';

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">📖 Help Center</h1>
              <p className="text-gray-500 mt-1">
                Guides, how-tos, and reference documentation for ControlWeave.
              </p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
              {currentTierLabel} tier
            </span>
          </div>

          {/* Search */}
          <div className="mt-4">
            <input
              type="text"
              placeholder="Search help articles…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600" />
          </div>
        ) : selectedSlug ? (
          /* ── Article Viewer ── */
          <div>
            <button
              onClick={() => { setSelectedSlug(null); setArticleContent(''); setArticleError(''); }}
              className="mb-6 flex items-center text-sm text-purple-600 hover:text-purple-800 font-medium"
            >
              ← Back to Help Center
            </button>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
              <div className="flex items-center gap-3 mb-6">
                <span className="text-4xl">{articleIcon}</span>
                <h2 className="text-2xl font-bold text-gray-900">{articleTitle}</h2>
              </div>

              {articleLoading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
                </div>
              ) : articleError ? (
                <div className="text-center py-16">
                  <p className="text-3xl mb-3">🔒</p>
                  <p className="text-gray-600">{articleError}</p>
                  <p className="text-sm text-gray-400 mt-2">Upgrade your plan to access this content.</p>
                </div>
              ) : (
                <div
                  className="prose prose-sm max-w-none text-gray-700 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: `<div>${renderMarkdown(articleContent)}</div>` }}
                />
              )}
            </div>
          </div>
        ) : (
          /* ── Article Index ── */
          <div className="space-y-10">
            {Object.keys(filteredCategories).length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <p className="text-4xl mb-4">🔍</p>
                <p>No articles match your search.</p>
              </div>
            ) : (
              Object.entries(filteredCategories).map(([category, articles]) => (
                <div key={category}>
                  <h2 className="text-lg font-semibold text-gray-700 mb-4 uppercase tracking-wide text-sm">
                    {category}
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {articles.map((article) => (
                      <div
                        key={article.slug}
                        onClick={() =>
                          !article.locked && openArticle(article.slug, article.title, article.icon)
                        }
                        className={`relative bg-white border rounded-xl p-5 transition-all ${
                          article.locked
                            ? 'opacity-60 cursor-not-allowed border-gray-200'
                            : 'cursor-pointer border-gray-200 hover:border-purple-400 hover:shadow-md'
                        }`}
                      >
                        {article.locked && (
                          <div className="absolute top-3 right-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-medium ${TIER_COLORS[article.minTierRequired] || 'bg-gray-100 text-gray-600'}`}
                            >
                              🔒 {TIER_LABELS[article.minTierRequired] || article.minTierRequired}+
                            </span>
                          </div>
                        )}
                        <div className="text-3xl mb-3">{article.icon}</div>
                        <h3 className="text-base font-semibold text-gray-900 mb-1">{article.title}</h3>
                        <p className="text-sm text-gray-500 leading-relaxed">{article.description}</p>
                        {!article.locked && (
                          <p className="text-xs text-purple-500 font-medium mt-3">Read guide →</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
