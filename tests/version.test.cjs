const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');

test('Client Lite release metadata and visible badge match the version manifest', () => {
  const version = JSON.parse(read('client-lite-version.json'));
  const html = read('lite-demo.html');
  const manager = read('task-manager.html');
  const changelog = read('CLIENT_LITE_CHANGELOG.md');

  assert.equal(version.release, `${version.major}.${version.minor}.${version.patch}-${version.prerelease}`);
  assert.equal(version.tag, `client-lite-v${version.release}`);
  assert.match(html, new RegExp(`name="application-version" content="${version.release.replaceAll('.', '\\.') }"`));
  assert.ok(html.includes(`data-release="${version.release}"`));
  assert.ok(html.includes(`>${version.display}</span>`));
  assert.ok(html.includes(`lite-demo.css?v=${version.release}`));
  assert.ok(html.includes(`lite-store.js?v=${version.release}`));
  assert.ok(html.includes(`task-scheduler.js?v=${version.release}`));
  assert.ok(html.includes(`gantt-hours.js?v=${version.release}`));
  assert.ok(html.includes(`lite-demo.js?v=${version.release}`));
  assert.ok(html.includes(`task-manager.html?embedded=1&amp;v=${version.release}`));
  assert.ok(manager.includes(`task-manager.css?v=${version.release}`));
  assert.ok(manager.includes(`task-scheduler.js?v=${version.release}`));
  assert.ok(manager.includes(`task-manager.js?v=${version.release}`));
  assert.ok(changelog.includes(`## ${version.release}`));
});
