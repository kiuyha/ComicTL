interface SiteAdapter {
  seriesName: (title?: string) => string | null;
  chapterId: () => string;
  pageIndex: () => number;
}

const adapters: Record<string, SiteAdapter> = {
  'mangadex.org': {
    seriesName: (title) => (title ?? document.title).split(' - ').at(-2)?.trim() ?? null,
    chapterId:  () => location.pathname.match(/\/chapter\/([^/]+)/)?.[1] ?? 'unknown',
    pageIndex:  () => Number(location.pathname.split('/').at(-1) ?? 0),
  },
};

export function getAdapter(hostname?: string): SiteAdapter {
  const host = hostname ?? location.hostname;
  return adapters[host] ?? {
    seriesName: (title) => (title ?? document.title).split(/[-|-]/)[0].trim() || null,
    chapterId:  () => location.pathname.replace(/\//g, '-').slice(1) || 'unknown',
    pageIndex:  () => 0,
  };
}