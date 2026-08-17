<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:sm="http://www.sitemaps.org/schemas/sitemap/0.9">
  <xsl:output method="html" encoding="UTF-8" indent="yes"/>
  <xsl:template match="/">
    <html lang="fr">
      <head>
        <meta charset="utf-8"/>
        <title>Plan du site — Le Quotidien Actu</title>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <style>
          :root { color-scheme: light; }
          * { box-sizing: border-box; }
          body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Arial, sans-serif; background: #f8fafc; color: #0f172a; }
          header { background: #fff; border-bottom: 1px solid #e2e8f0; padding: 2.5rem 1.5rem 2rem; }
          .wrap { max-width: 960px; margin: 0 auto; }
          h1 { font-size: 1.85rem; font-weight: 800; margin: 0; letter-spacing: -0.01em; }
          .eyebrow { font-size: 0.75rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #c2410c; margin: 0 0 0.6rem; }
          .count { color: #64748b; font-size: 0.9rem; margin: 0.6rem 0 0; }
          main { padding: 2rem 1.5rem 3rem; }
          .wrap table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #e2e8f0; border-radius: 0.75rem; overflow: hidden; }
          thead th { text-align: left; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; padding: 0.9rem 1.25rem; background: #f8fafc; border-bottom: 1px solid #e2e8f0; }
          tbody td { padding: 0.85rem 1.25rem; border-bottom: 1px solid #f1f5f9; font-size: 0.88rem; vertical-align: top; }
          tbody tr:last-child td { border-bottom: none; }
          tbody tr:hover { background: #fff7ed; }
          a { color: #c2410c; text-decoration: none; font-weight: 600; word-break: break-all; }
          a:hover { text-decoration: underline; }
          .lastmod { color: #94a3b8; white-space: nowrap; font-size: 0.82rem; }
          footer { max-width: 960px; margin: 0 auto; padding: 0 1.5rem 3rem; color: #94a3b8; font-size: 0.8rem; }
          .empty { padding: 2.5rem; text-align: center; color: #94a3b8; background: #fff; border: 1px dashed #e2e8f0; border-radius: 0.75rem; }
        </style>
      </head>
      <body>
        <xsl:choose>
          <xsl:when test="sm:sitemapindex">
            <header>
              <div class="wrap">
                <p class="eyebrow">Le Quotidien Actu</p>
                <h1>Plan du site</h1>
                <p class="count"><xsl:value-of select="count(sm:sitemapindex/sm:sitemap)"/> sous-plan(s)</p>
              </div>
            </header>
            <main>
              <div class="wrap">
                <xsl:choose>
                  <xsl:when test="count(sm:sitemapindex/sm:sitemap) &gt; 0">
                    <table>
                      <thead><tr><th>Sous-plan</th><th>Dernière modification</th></tr></thead>
                      <tbody>
                        <xsl:for-each select="sm:sitemapindex/sm:sitemap">
                          <tr>
                            <td><a href="{sm:loc}"><xsl:value-of select="sm:loc"/></a></td>
                            <td class="lastmod"><xsl:value-of select="sm:lastmod"/></td>
                          </tr>
                        </xsl:for-each>
                      </tbody>
                    </table>
                  </xsl:when>
                  <xsl:otherwise>
                    <p class="empty">Aucun sous-plan pour le moment.</p>
                  </xsl:otherwise>
                </xsl:choose>
              </div>
            </main>
          </xsl:when>
          <xsl:otherwise>
            <header>
              <div class="wrap">
                <p class="eyebrow">Le Quotidien Actu</p>
                <h1>Plan du site — Adresses</h1>
                <p class="count"><xsl:value-of select="count(sm:urlset/sm:url)"/> adresse(s)</p>
              </div>
            </header>
            <main>
              <div class="wrap">
                <xsl:choose>
                  <xsl:when test="count(sm:urlset/sm:url) &gt; 0">
                    <table>
                      <thead><tr><th>URL</th><th>Dernière modification</th></tr></thead>
                      <tbody>
                        <xsl:for-each select="sm:urlset/sm:url">
                          <tr>
                            <td><a href="{sm:loc}"><xsl:value-of select="sm:loc"/></a></td>
                            <td class="lastmod"><xsl:value-of select="sm:lastmod"/></td>
                          </tr>
                        </xsl:for-each>
                      </tbody>
                    </table>
                  </xsl:when>
                  <xsl:otherwise>
                    <p class="empty">Aucune adresse pour le moment.</p>
                  </xsl:otherwise>
                </xsl:choose>
              </div>
            </main>
          </xsl:otherwise>
        </xsl:choose>
        <footer>Généré automatiquement pour les moteurs de recherche — ce fichier reste un XML valide (cette mise en forme n’apparaît qu’au chargement dans un navigateur).</footer>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
