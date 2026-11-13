import webpack from 'webpack';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';

const project = fileURLToPath(new URL('../', import.meta.url));
const legacy = path.join(project, 'legacy', 'resume');
const output = path.join(project, 'public', 'resume');
const require = createRequire(import.meta.url);
const originalPackage = require(path.join(legacy, 'package.json'));
const originalTailwind = require(path.join(legacy, 'tailwind.config.js'));

await fs.mkdir(output, { recursive: true });
await fs.cp(path.join(legacy, 'public'), output, { recursive: true });
await fs.cp(path.join(legacy, 'src', 'fonts'), path.join(output, 'fonts'), { recursive: true });

const originalStyles = await fs.readFile(path.join(legacy, 'src', 'index.css'), 'utf8');
const css = await postcss([
  tailwindcss({
    ...originalTailwind,
    content: [path.join(legacy, 'src', '**', '*.{js,jsx,ts,tsx}').replaceAll('\\', '/')],
  }),
  autoprefixer({ overrideBrowserslist: originalPackage.browserslist.production }),
]).process(originalStyles, { from: path.join(legacy, 'src', 'index.css'), to: path.join(output, 'resume.css'), map: false });
await fs.writeFile(path.join(output, 'resume.css'), css.css);

await new Promise((resolve, reject) => {
  const compiler = webpack({
    mode: 'production',
    context: project,
    entry: path.join(legacy, 'mount.jsx'),
    target: 'web',
    output: { path: output, filename: 'resume.js', publicPath: '/resume/' },
    resolve: { extensions: ['.js', '.jsx', '.json'] },
    module: {
      rules: [{
        test: /\.[jt]sx?$/,
        include: legacy,
        use: {
          loader: require.resolve('babel-loader'),
          options: {
            babelrc: false,
            configFile: false,
            cacheDirectory: false,
            presets: [
              [require.resolve('@babel/preset-env'), { targets: originalPackage.browserslist.production }],
              [require.resolve('@babel/preset-react'), { runtime: 'automatic' }],
            ],
          },
        },
      }],
    },
    devtool: false,
    performance: false,
  });
  compiler.run((error, stats) => {
    compiler.close(closeError => {
      if (error || closeError) return reject(error || closeError);
      if (!stats || stats.hasErrors()) return reject(new Error(stats?.toString({ all: false, errors: true }) || 'Resume build failed'));
      console.log(stats.toString({ all: false, assets: true, timings: true, warnings: true }));
      resolve();
    });
  });
});

let html = await fs.readFile(path.join(legacy, 'public', 'index.html'), 'utf8');
html = html.replaceAll('%PUBLIC_URL%', '/resume');
html = html.replace('</head>', '    <link rel="stylesheet" href="/resume/resume.css" />\n  </head>');
html = html.replace('</head>', '<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin><link rel="stylesheet" href="/typography.css?v=20261112-1"></head>');
html = html.replace('</head>', '<script src="/theme.js?v=20261113-1"></script><link rel="stylesheet" href="/taste.css?v=20261113-1"></head>');
html = html.replace('</head>', '<link rel="stylesheet" href="/atmosphere.css?v=20261113-review-2"></head>');
html = html.replace('</head>', '<link rel="stylesheet" href="/resume-details.css?v=20261114-1"></head>');
html = html.replace('<html lang="en">', '<html lang="ko" data-theme="dark">');
html = html.replace('<body>', '<body data-typography="resume">');
html = html.replace('</body>', '    <script defer src="/resume/resume.js"></script>\n  </body>');
await fs.writeFile(path.join(output, 'index.html'), html);
console.log('Resume: source compiled to public/resume (isolated HTML document).');


