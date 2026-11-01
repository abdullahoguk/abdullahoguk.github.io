// JSON-LD (schema.org) graph builder.
// Every page emits one @graph containing: WebSite, Person (the hub entity),
// the page entity (ProfilePage / CollectionPage / BlogPosting …) and breadcrumbs.
// Person data comes entirely from src/_data/site.yaml + resume.yaml + projects.yaml.

// bilingual fields are { tr, en } — flatten for machines
export const plain = (v) => (v && typeof v === "object" ? [v.tr, v.en].filter(Boolean).join(" — ") : String(v ?? "").trim()).replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

const abs = (site, p) => (p ? new URL(p, site.url).href : undefined);
const clean = (obj) =>
  JSON.parse(JSON.stringify(obj, (_k, v) => (v === "" || v === null || (Array.isArray(v) && !v.length) ? undefined : v)));

export function personNode(site, resume = {}, projects = []) {
  const a = site.author;
  const id = `${site.url}/#person`;
  const sameAs = (site.links || [])
    .flatMap((g) => g.items)
    .filter((l) => l.sameAs !== false && /^https?:/.test(l.url))
    .map((l) => l.url);

  return {
    "@type": "Person",
    "@id": id,
    name: a.name,
    givenName: a.givenName,
    familyName: a.familyName,
    alternateName: a.alternateName,
    url: `${site.url}/`,
    image: abs(site, a.image),
    email: a.email ? `mailto:${a.email}` : undefined,
    jobTitle: [a.jobTitle, a.jobTitleTr].filter(Boolean),
    description: plain(site.description),
    knowsAbout: a.knowsAbout,
    knowsLanguage: a.languages,
    homeLocation: a.location?.city
      ? { "@type": "Place", name: a.location.city, address: { "@type": "PostalAddress", addressLocality: a.location.city, addressCountry: a.location.country } }
      : undefined,
    worksFor: [].concat(a.worksFor || []).filter((o) => o?.name).map((o) => ({ "@type": "Organization", name: o.name, url: o.url })),
    alumniOf: (a.alumniOf || []).map((s) => ({ "@type": "CollegeOrUniversity", name: s.name, url: s.url })),
    hasOccupation: {
      "@type": "Occupation",
      name: a.jobTitle,
      skills: (resume.skills || []).flatMap((s) => s.items).filter((s) => s && s !== "TODO").join(", ") || undefined,
    },
    sameAs,
    owns: projects
      .map((p) => ({ "@id": `${site.url}/projects/#${p.id}` })),
  };
}

export function websiteNode(site) {
  return {
    "@type": "WebSite",
    "@id": `${site.url}/#website`,
    url: `${site.url}/`,
    name: site.title,
    description: plain(site.description),
    inLanguage: ["tr", "en"],
    publisher: { "@id": `${site.url}/#person` },
  };
}

export function projectNode(site, p) {
  return {
    "@type": p.schema || "CreativeWork",
    "@id": `${site.url}/projects/#${p.id}`,
    name: p.title,
    description: plain(p.summary),
    url: p.url || `${site.url}/projects/${p.page ? `${p.id}/` : `#${p.id}`}`,
    image: abs(site, p.image),
    codeRepository: p.repo,
    creativeWorkStatus: p.status === "archived" ? "Archived" : p.status === "wip" ? "In development" : undefined,
    sameAs: [p.repo, ...(p.links || []).map((l) => l.url)].filter(Boolean),
    creator: { "@id": `${site.url}/#person` },
    keywords: (p.stack || []).join(", "),
    ...(p.schema === "SoftwareApplication" ? { applicationCategory: "WebApplication", operatingSystem: "Web" } : {}),
  };
}

function breadcrumbs(site, page, title) {
  if (page.url === "/") return undefined;
  const parts = page.url.split("/").filter(Boolean);
  const items = [{ name: site.title, item: `${site.url}/` }];
  let acc = "";
  parts.forEach((part, i) => {
    acc += `/${part}`;
    items.push({ name: i === parts.length - 1 ? title : part, item: `${site.url}${acc}/` });
  });
  return {
    "@type": "BreadcrumbList",
    "@id": `${site.url}${page.url}#breadcrumbs`,
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, ...it })),
  };
}

/**
 * @param {object} ctx  { site, resume, projects, page, title, description, kind, items, post }
 *   kind: profile | collection | post | resume | page
 */
export function buildGraph(ctx) {
  const { site, resume, projects = [], page, title, description, kind = "page", items = [], post } = ctx;
  const url = `${site.url}${page.url}`;
  const person = { "@id": `${site.url}/#person` };
  const graph = [websiteNode(site)];

  if (kind === "profile" || kind === "resume") {
    graph.push(personNode(site, resume, projects));
  } else {
    // keep the hub entity on every page but light-weight
    graph.push({ "@type": "Person", "@id": `${site.url}/#person`, name: site.author.name, url: `${site.url}/` });
  }

  const base = {
    "@id": `${url}#webpage`,
    url,
    name: title,
    description,
    isPartOf: { "@id": `${site.url}/#website` },
    inLanguage: ["tr", "en"],
    breadcrumb: page.url === "/" ? undefined : { "@id": `${url}#breadcrumbs` },
  };

  if (kind === "profile") {
    graph.push({ ...base, "@type": "ProfilePage", mainEntity: person, about: person, dateModified: new Date().toISOString() });
    graph.push(...items); // project nodes referenced by Person.owns
  } else if (kind === "resume") {
    graph.push({ ...base, "@type": "ProfilePage", mainEntity: person });
  } else if (kind === "post" && post) {
    graph.push({ ...base, "@type": "WebPage" });
    graph.push({
      "@type": "BlogPosting",
      "@id": `${url}#article`,
      headline: title,
      description,
      url,
      datePublished: post.date && new Date(post.date).toISOString(),
      dateModified: new Date(post.updated || post.date).toISOString(),
      inLanguage: post.lang || "tr",
      keywords: (post.tags || []).filter((t) => t !== "post").join(", "),
      author: person,
      publisher: person,
      mainEntityOfPage: { "@id": `${url}#webpage` },
      image: abs(site, post.image || site.ogImage),
    });
  } else if (kind === "collection") {
    graph.push({
      ...base,
      "@type": "CollectionPage",
      about: person,
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: items.length,
        itemListElement: items.map((item, i) => ({ "@type": "ListItem", position: i + 1, item })),
      },
    });
  } else {
    graph.push({ ...base, "@type": "WebPage", about: person });
  }

  const bc = breadcrumbs(site, page, title);
  if (bc) graph.push(bc);

  return clean({ "@context": "https://schema.org", "@graph": graph });
}

// Item mappers for collection pages
export const mappers = {
  projects: (site, list) => list.map((p) => projectNode(site, p)),
  books: (site, list) =>
    list.map((b) => clean({
      "@type": "Book",
      name: b.title,
      author: b.author ? { "@type": "Person", name: b.author } : undefined,
      isbn: b.isbn,
      url: b.url,
      review: b.rating ? { "@type": "Review", author: { "@id": `${site.url}/#person` }, reviewRating: { "@type": "Rating", ratingValue: b.rating, bestRating: 5 } } : undefined,
    })),
  watched: (site, list) =>
    list.map((w) => clean({
      "@type": w.type === "series" ? "TVSeries" : "Movie",
      name: w.title,
      dateCreated: w.year ? String(w.year) : undefined,
      director: w.director ? { "@type": "Person", name: w.director } : undefined,
      url: w.imdb ? `https://www.imdb.com/title/${w.imdb}/` : w.url,
      sameAs: w.imdb ? `https://www.imdb.com/title/${w.imdb}/` : undefined,
      review: w.rating ? { "@type": "Review", author: { "@id": `${site.url}/#person` }, reviewRating: { "@type": "Rating", ratingValue: w.rating, bestRating: 5 } } : undefined,
    })),
  bookmarks: (site, list) =>
    list.map((b) => clean({ "@type": "WebPage", name: b.title, url: b.url, description: b.note, keywords: (b.tags || []).join(", ") })),
  listens: (site, list) =>
    list.map((p) => clean({ "@type": "MusicPlaylist", name: p.title, description: p.note, url: p.url, creator: { "@id": `${site.url}/#person` } })),
  posts: (site, list) =>
    list.map((p) => ({ "@type": "BlogPosting", headline: p.data.title, url: `${site.url}${p.url}`, datePublished: p.date.toISOString() })),
};
