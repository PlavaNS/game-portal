// The /guides/ section: original long-form articles from data/articles.json (written by scripts/write-articles.mjs).
// Called once by build.mjs, English only.
export function emitArticles({ ART, all, topics, layout, write, addUrl, textPage, abs, ur, esc, gHref, tHref, cfg }) {
  const bySlug = new Map(all.map(g => [g.slug, g]));
  const topicBy = new Map(topics.map(t => [t.slug, t]));
  const items = Object.entries(ART)
    .filter(([, a]) => topicBy.has(a.topic) && a.picks.filter(p => bySlug.has(p.slug)).length >= 3)
    .sort((a, b) => a[1].title.localeCompare(b[1].title));
  if (!items.length) return;
  for (const [slug, a] of items) {
    const t = topicBy.get(a.topic);
    const picks = a.picks.filter(p => bySlug.has(p.slug));
    const same = items.filter(([s, o]) => o.topic === a.topic && s !== slug).slice(0, 2);
    const body = `<nav class="crumbs"><a href="${ur('/')}">Home</a> &rsaquo; <a href="${ur('/guides/')}">Guides</a> &rsaquo; <span>${esc(t.h1)}</span></nav>
<article class="text"><h1>${esc(a.title)}</h1>
<p class="lead">${esc(a.intro)}</p>
${a.sections.map(s => `<h2>${esc(s.h2)}</h2>${s.body.map(p => `<p>${esc(p)}</p>`).join('')}`).join('\n')}
<h2>Games to try</h2>
<ul class="picks">${picks.map(p => `<li><a href="${gHref({ slug: p.slug })}">${esc(p.title)}</a>: ${esc(p.line)}</li>`).join('')}</ul>
<h2>Questions people ask</h2>
${a.faq.map(([q, an]) => `<h3>${esc(q)}</h3><p>${esc(an)}</p>`).join('')}
<p>More on this topic: <a href="${tHref(t.slug)}">${esc(t.h1)}</a>${same.map(([s, o]) => ` &middot; <a href="${ur(`/guides/${s}/`)}">${esc(o.title)}</a>`).join('')} &middot; <a href="${ur('/guides/')}">All guides</a></p>
</article>`;
    const ld = [{
      '@context': 'https://schema.org', '@type': 'Article', headline: a.title, description: a.description,
      datePublished: a.date, dateModified: a.date, mainEntityOfPage: abs(`/guides/${slug}/`),
      author: { '@type': 'Organization', name: cfg.name, url: abs('/') }, publisher: { '@type': 'Organization', name: cfg.name, url: abs('/') },
    }, {
      '@context': 'https://schema.org', '@type': 'FAQPage',
      mainEntity: a.faq.map(([q, an]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: an } })),
    }];
    write(`guides/${slug}/index.html`, layout({ title: `${a.title} | ${cfg.name}`, desc: a.description, canonical: abs(`/guides/${slug}/`), body, jsonld: ld }));
    addUrl(`/guides/${slug}/`, 0.6, null, a.date);
  }
  const byTopic = new Map();
  for (const [slug, a] of items) (byTopic.get(a.topic) || byTopic.set(a.topic, []).get(a.topic)).push([slug, a]);
  const html = `<p class="lead">Practical guides to the kinds of games on ${esc(cfg.name)}: how to get better, where to start, and how the different types play.</p>
${[...byTopic.entries()].sort((x, y) => topicBy.get(x[0]).h1.localeCompare(topicBy.get(y[0]).h1)).map(([tp, list]) => `<h2><a href="${tHref(tp)}">${esc(topicBy.get(tp).h1)}</a></h2>
<ul class="picks">${list.map(([s, o]) => `<li><a href="${ur(`/guides/${s}/`)}">${esc(o.title)}</a></li>`).join('')}</ul>`).join('\n')}`;
  textPage('guides', 'Game Guides and Tips', html, `Guides to browser games: tips for getting better, beginner starts and the main types explained, for ${byTopic.size} kinds of games.`, [], 0.7);
}
