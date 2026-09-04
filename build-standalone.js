#!/usr/bin/env node
/*
 * Generates a self-contained, single-file version of the demo (library inlined),
 * suitable for publishing as an Artifact or opening without a server.
 *
 *   node build-standalone.js [outfile]
 *
 * It takes demo/index.html as the single source of truth, inlines
 * src/gsap-attributes.js, and strips the document wrapper so the output is just
 * <title> + <style> + body content.
 */
const fs = require('fs');
const path = require('path');

const root = __dirname;
const lib = fs.readFileSync(path.join(root, 'src/gsap-attributes.js'), 'utf8');
const demo = fs.readFileSync(path.join(root, 'demo/index.html'), 'utf8');

const title = (demo.match(/<title>[\s\S]*?<\/title>/) || ['<title>GSAP in Attributes</title>'])[0];
const style = (demo.match(/<style>[\s\S]*?<\/style>/) || [''])[0];
let body = (demo.match(/<body[^>]*>([\s\S]*)<\/body>/) || [, ''])[1];

// Swap the two loader tags (debug + external src) for the inlined library.
body = body
  .replace(/<script>\s*window\.GSAPAttr\s*=\s*\{[^}]*\};\s*<\/script>/, '<script>window.GSAPAttr = { debug: false };</script>')
  .replace(/<script\s+src=["']\.\.\/src\/gsap-attributes\.js["']><\/script>/,
    '<script>\n' + lib + '\n</script>');

const out = process.argv[2] || path.join(root, 'demo/standalone.html');
fs.writeFileSync(out, title + '\n' + style + '\n' + body.trim() + '\n');
console.log('Wrote', out, '(' + Buffer.byteLength(fs.readFileSync(out)) + ' bytes)');
