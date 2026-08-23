hexo.extend.filter.register('inject_ready', function(inject) {
  hexo.log && hexo.log.info && hexo.log.info('mermaid: inject_ready called');
  inject.headEnd.script({src: 'https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js'}, '');
  inject.bodyEnd.script({}, `
    document.addEventListener('DOMContentLoaded', function() {
      if (window.mermaid) {
        mermaid.initialize({startOnLoad:false, flowchart:{curve:'linear'}});
        mermaid.init(undefined, document.querySelectorAll('.mermaid'));
      }
    });
  `);
});

hexo.extend.filter.register('before_post_render', function(data) {
  if (!data.content) return data;

  const mermaidRegex = /(^|\r?\n)```mermaid[ \t]*\r?\n([\s\S]+?)\r?\n```/g;

  data.content = data.content.replace(mermaidRegex, function(_, prefix, content) {
    return prefix + '<div class="mermaid">' + content + '</div>\n';
  });

  return data;
});

// Fallback: after HTML is rendered, if mermaid blocks still appear as highlighted/plaintext
// replace them with <div class="mermaid">...</div> and ensure runtime initialization
hexo.extend.filter.register('after_render:html', function(html) {
  try {
    if (!/```mermaid|class=\"mermaid\"|flowchart|sequenceDiagram|subgraph/.test(html)) return html;
    hexo.log && hexo.log.info && hexo.log.info('mermaid: after_render:html running fallback replacement');

    // Replace <figure ...> that contains highlighted code with a mermaid div when the code
    // looks like mermaid source (heuristic: contains common mermaid keywords).
    html = html.replace(/<figure[^>]*class=["'][^"']*highlight[^"']*["'][^>]*>[\s\S]*?(?:<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>|<table[^>]*>[\s\S]*?<td[^>]*class=["']gutter["'][^>]*>[\s\S]*?<\/td>[\s\S]*?<td[^>]*>[\s\S]*?<pre[^>]*>([\s\S]*?)<\/pre>[\s\S]*?<\/td>)[\s\S]*?<\/figure>/gim,
      function(figureHtml) {
        // Try to extract code from an inline <pre><code> block first.
        var match = figureHtml.match(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/i);
        var codeContent = match ? match[1] : null;

        if (!codeContent) {
          // Fallback to highlight.js table-style output with gutter and code columns.
          match = figureHtml.match(/<td[^>]*class=["']code["'][^>]*>[\s\S]*?<pre[^>]*>([\s\S]*?)<\/pre>[\s\S]*?<\/td>/i);
          codeContent = match ? match[1] : null;
        }

        if (!codeContent) {
          // Last resort: first <pre> inside a figure, if any.
          match = figureHtml.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
          codeContent = match ? match[1] : null;
        }

        if (!codeContent) return figureHtml;

        var code = codeContent.replace(/<br\s*\/?\s*>/gi, '\n').replace(/<[^>]+>/g, '');
        code = code.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x2F;/g, '/');
        code = code.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        code = code.replace(/^\s+|\s+$/g, '');

        if (!/(^|\n)\s*(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram|gantt|erDiagram|subgraph)\b/i.test(code)) {
          return figureHtml;
        }

        return '<div class="mermaid">' + code + '</div>';
    });

    // Inject a safe mermaid init script at the end of body to ensure rendering runs
    // (avoid duplicating by checking a marker).
    if (!/mermaid-init-marker/.test(html)) {
      var initScript = '\n<!-- mermaid-init-marker -->\n<script>(function(){function _init(){try{if(window.mermaid){mermaid.initialize({startOnLoad:false,flowchart:{curve:\'linear\'}});mermaid.init(undefined,document.querySelectorAll(\'.mermaid\'));}}catch(e){console && console.error && console.error(e);}}if(document.readyState===\'loading\'){document.addEventListener(\'DOMContentLoaded\',_init);}else{setTimeout(_init,0);} })();</script>\n';
      html = html.replace(/<\/body>/i, initScript + '</body>');
    }

    // Ensure mermaid runtime is present: inject into head if missing (minimal injection)
    if (!/mermaid\.min\.js/.test(html)) {
      var headInject = '<script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>\n';
      html = html.replace(/<\/head>/i, headInject + '</head>');
    }
  } catch (e) {
    hexo.log && hexo.log.error && hexo.log.error('mermaid fallback error', e.stack || e);
  }
  return html;
});
