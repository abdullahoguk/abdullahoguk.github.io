// Detail pages for projects: src/projects/<id>.md
// Title, summary, links etc. come from projects.yaml (matched by file name);
// the markdown body is the long description.
export default {
  layout: "project.njk",
  schemaKind: "page",
  permalink: (data) => `/projects/${data.page.fileSlug}/`,
  eleventyComputed: {
    project: (data) => (data.projects || []).find((p) => p.id === data.page.fileSlug) || {},
    title: (data) => data.title || (data.projects || []).find((p) => p.id === data.page.fileSlug)?.title,
    description: (data) => data.description || (data.projects || []).find((p) => p.id === data.page.fileSlug)?.summary,
    image: (data) => data.image || (data.projects || []).find((p) => p.id === data.page.fileSlug)?.image,
  },
};
