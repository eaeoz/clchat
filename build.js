import { build } from 'esbuild';
import { readFileSync, writeFileSync, readdirSync, mkdirSync, cpSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const widgetDir = resolve(__dirname, 'node_modules/blessed/lib/widgets');
const widgetFiles = readdirSync(widgetDir).filter(f => f.endsWith('.js')).map(f => f.replace('.js', ''));

// Copy blessed's usr/ terminfo files next to the bundle
// In the CJS bundle, __dirname = dist/, so blessed looks for ../usr/xterm
const blessedUsr = resolve(__dirname, 'node_modules/blessed/usr');
const projectUsr = resolve(__dirname, 'usr');
cpSync(blessedUsr, projectUsr, { recursive: true });

const staticWidgetPlugin = {
  name: 'static-blessed-widgets',
  setup(build) {
    build.onLoad({ filter: /blessed[\\/]lib[\\/]widget\.js$/ }, async (args) => {
      const code = widgetFiles.map(name => {
        const className = name.charAt(0).toUpperCase() + name.slice(1);
        return `widget['${className}'] = widget['${name}'] = require('./widgets/${name}');`;
      }).join('\n');

      const contents = `
var widget = exports;
widget.classes = ${JSON.stringify(widgetFiles.map(n => n.charAt(0).toUpperCase() + n.slice(1)))};
${code}
widget.aliases = { 'ListBar': 'Listbar', 'PNG': 'ANSIImage' };
Object.keys(widget.aliases).forEach(function(key) {
  var name = widget.aliases[key];
  widget[key] = widget[name];
  widget[key.toLowerCase()] = widget[name];
});
`;
      return { contents, loader: 'js' };
    });
  }
};

// Bundle
await build({
  entryPoints: [resolve(__dirname, 'src/index.js')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: resolve(__dirname, 'dist/cli.cjs'),
  external: ['term.js', 'pty.js'],
  plugins: [staticWidgetPlugin],
  logLevel: 'info',
});

// Strip shebang
const bundlePath = resolve(__dirname, 'dist/cli.cjs');
const content = readFileSync(bundlePath, 'utf8');
if (content.startsWith('#!')) {
  writeFileSync(bundlePath, content.slice(content.indexOf('\n') + 1));
}

// Generate SEA blob
execSync('node --experimental-sea-config sea-config.json', { cwd: __dirname, stdio: 'inherit' });

// Copy node.exe and inject blob
const nodePath = execSync('where node', { encoding: 'utf8' }).trim().split('\n')[0];
const exePath = resolve(__dirname, 'dist/clchat.exe');
cpSync(nodePath, exePath);
execSync(`npx postject "${exePath}" NODE_SEA_BLOB dist/clchat.blob --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2`, { cwd: __dirname, stdio: 'inherit' });

console.log('Build complete: dist/clchat.exe');
