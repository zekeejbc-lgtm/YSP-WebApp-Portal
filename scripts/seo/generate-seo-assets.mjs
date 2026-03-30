import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");
const buildDir = path.join(repoRoot, "build");
const publicDir = path.join(repoRoot, "public");
const buildIndexPath = path.join(buildDir, "index.html");

const siteOrigin = process.env.VITE_SITE_ORIGIN || "https://tgm.youthserviceph.org";
const shortName = process.env.VITE_SHORT_NAME || "YSP Tagum";
const chapterName = process.env.VITE_CHAPTER_NAME || "Tagum Chapter";
const fullName = process.env.VITE_FULL_NAME || `Youth Service Philippines - ${chapterName}`;
const portalName = process.env.VITE_PORTAL_NAME || `${shortName} Portal`;
const ogImage = `${siteOrigin}/social-preview-image.png`;
const today = new Date().toISOString().slice(0, 10);

const prerenderPages = [
  {
    path: "/Home",
    title: `${portalName} | ${fullName}`,
    description: `Official ${portalName}. Join youth leadership, volunteer, and community service opportunities in Tagum City.`,
    keywords: `${shortName}, Youth Service Philippines, ${chapterName}, youth leadership, volunteers`,
    heading: fullName,
    body: "Discover youth leadership, civic programs, volunteer opportunities, and official chapter updates.",
    indexable: true,
  },
  {
    path: "/feedback",
    title: `Feedback | ${portalName}`,
    description: `Share feedback with ${fullName} to help improve chapter services, projects, and member support.`,
    keywords: `${shortName} feedback, youth service feedback, chapter feedback`,
    heading: "Feedback",
    body: "Send your feedback, suggestions, and reports to help improve chapter services.",
    indexable: true,
  },
  {
    path: "/opportunities",
    title: `Opportunities | ${shortName}`,
    description: `Explore chapter opportunities, open calls, and ways to join ${fullName} programs.`,
    keywords: `${shortName} opportunities, join youth service philippines, youth opportunities`,
    heading: "Opportunities",
    body: "Explore membership and chapter opportunities for youth leaders and volunteers.",
    indexable: true,
  },
  {
    path: "/founder",
    title: `Founder | ${shortName}`,
    description: `Learn about the founder story and leadership roots of ${fullName}.`,
    keywords: `${shortName} founder, youth service philippines founder, chapter history`,
    heading: "Founder",
    body: "Read the founder profile and chapter history of Youth Service Philippines.",
    indexable: true,
  },
  {
    path: "/developer",
    title: `Developer | ${portalName}`,
    description: `Meet the developer and technical lead behind the ${portalName}.`,
    keywords: `${shortName} developer, chapter portal developer, technical support`,
    heading: "Developer",
    body: "View information about the portal developer and technical support channel.",
    indexable: true,
  },
];

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function replaceOrInsert(html, pattern, replacement) {
  if (pattern.test(html)) {
    return html.replace(pattern, replacement);
  }
  return html.replace("</head>", `${replacement}\n</head>`);
}

function setMetaByName(html, name, content) {
  const escapedName = escapeRegExp(name);
  const pattern = new RegExp(`<meta\\s+[^>]*name=["']${escapedName}["'][^>]*>`, "i");
  const replacement = `<meta name="${name}" content="${escapeHtml(content)}" />`;
  return replaceOrInsert(html, pattern, replacement);
}

function setMetaByProperty(html, property, content) {
  const escapedProperty = escapeRegExp(property);
  const pattern = new RegExp(`<meta\\s+[^>]*property=["']${escapedProperty}["'][^>]*>`, "i");
  const replacement = `<meta property="${property}" content="${escapeHtml(content)}" />`;
  return replaceOrInsert(html, pattern, replacement);
}

function setCanonical(html, canonicalUrl) {
  const pattern = /<link\s+[^>]*rel=["']canonical["'][^>]*>/i;
  const replacement = `<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />`;
  return replaceOrInsert(html, pattern, replacement);
}

function setTitle(html, title) {
  const pattern = /<title>[\s\S]*?<\/title>/i;
  const replacement = `<title>${escapeHtml(title)}</title>`;
  return replaceOrInsert(html, pattern, replacement);
}

function buildWebPageJsonLd(page) {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: page.title,
    description: page.description,
    url: `${siteOrigin}${page.path}`,
    inLanguage: "en-PH",
    isPartOf: {
      "@type": "WebSite",
      name: fullName,
      url: `${siteOrigin}/Home`,
    },
  };
}

function injectWebPageJsonLd(html, page) {
  const markerPattern = /<script id="ysp-prerender-webpage-jsonld" type="application\/ld\+json">[\s\S]*?<\/script>/i;
  const jsonLd = JSON.stringify(buildWebPageJsonLd(page));
  const scriptTag = `<script id="ysp-prerender-webpage-jsonld" type="application/ld+json">${jsonLd}</script>`;
  return replaceOrInsert(html, markerPattern, scriptTag);
}

function injectFallbackContent(html, page) {
  const rootPattern = /<div id="root"><\/div>/i;
  const fallback = `<div id="root"><main style="max-width:760px;margin:0 auto;padding:48px 20px;font-family:Arial,sans-serif;line-height:1.6;color:#111827;"><h1 style="font-size:2rem;margin:0 0 12px;">${escapeHtml(page.heading)}</h1><p style="margin:0 0 16px;">${escapeHtml(page.body)}</p><p style="margin:0;"><a href="/Home" style="color:#ea580c;text-decoration:underline;">Open the ${escapeHtml(portalName)}</a></p></main></div>`;
  if (!rootPattern.test(html)) return html;
  return html.replace(rootPattern, fallback);
}

function applyPageSeo(templateHtml, page) {
  const canonicalUrl = `${siteOrigin}${page.path}`;
  let html = templateHtml;

  html = setTitle(html, page.title);
  html = setMetaByName(html, "title", page.title);
  html = setMetaByName(html, "description", page.description);
  html = setMetaByName(html, "keywords", page.keywords);
  html = setMetaByName(html, "robots", page.indexable ? "index, follow, max-image-preview:large" : "noindex, nofollow, noarchive");

  html = setMetaByProperty(html, "og:type", "website");
  html = setMetaByProperty(html, "og:site_name", fullName);
  html = setMetaByProperty(html, "og:title", page.title);
  html = setMetaByProperty(html, "og:description", page.description);
  html = setMetaByProperty(html, "og:url", canonicalUrl);
  html = setMetaByProperty(html, "og:image", ogImage);

  html = setMetaByName(html, "twitter:card", "summary_large_image");
  html = setMetaByName(html, "twitter:title", page.title);
  html = setMetaByName(html, "twitter:description", page.description);
  html = setMetaByName(html, "twitter:image", ogImage);
  html = setMetaByName(html, "twitter:url", canonicalUrl);

  html = setCanonical(html, canonicalUrl);
  html = injectWebPageJsonLd(html, page);
  html = injectFallbackContent(html, page);

  return html;
}

function buildSitemapXml(pages) {
  const urls = pages
    .filter((page) => page.indexable)
    .map((page) => {
      return [
        "  <url>",
        `    <loc>${siteOrigin}${page.path}</loc>`,
        `    <lastmod>${today}</lastmod>`,
        "    <changefreq>weekly</changefreq>",
        page.path === "/Home" ? "    <priority>1.0</priority>" : "    <priority>0.8</priority>",
        "  </url>",
      ].join("\n");
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

async function writePrerenderPage(templateHtml, page) {
  const relativeSegments = page.path.split("/").filter(Boolean);
  const outputDir = path.join(buildDir, ...relativeSegments);
  const outputFile = path.join(outputDir, "index.html");
  await mkdir(outputDir, { recursive: true });
  const pageHtml = applyPageSeo(templateHtml, page);
  await writeFile(outputFile, pageHtml, "utf8");
}

async function run() {
  const templateHtml = await readFile(buildIndexPath, "utf8");

  for (const page of prerenderPages) {
    await writePrerenderPage(templateHtml, page);
  }

  const sitemapXml = buildSitemapXml(prerenderPages);
  await writeFile(path.join(buildDir, "sitemap.xml"), sitemapXml, "utf8");
  await writeFile(path.join(publicDir, "sitemap.xml"), sitemapXml, "utf8");

  const manifest = {
    generatedAt: new Date().toISOString(),
    siteOrigin,
    pages: prerenderPages.map((page) => page.path),
  };
  await writeFile(path.join(buildDir, "prerender-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  console.log(`[seo] Generated ${prerenderPages.length} prerendered public pages.`);
  console.log("[seo] Updated sitemap.xml in build and public directories.");
}

run().catch((error) => {
  console.error("[seo] Postbuild generation failed:", error);
  process.exit(1);
});
