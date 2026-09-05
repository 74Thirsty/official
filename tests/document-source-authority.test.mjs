import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';

test('controlled documents remain a submodule of the authoritative Autobiography repository', async () => {
  const modules = await readFile(new URL('../.gitmodules', import.meta.url), 'utf8');
  assert.match(modules, /\[submodule "documentation-source"\]/);
  assert.match(modules, /path = documentation-source/);
  assert.match(modules, /url = https:\/\/github\.com\/LostLimbRider\/Autobiography/);

  const sourceMetadata = new URL('../documentation-source/.git', import.meta.url);
  assert.equal((await stat(sourceMetadata)).isFile(), true);
  assert.match(await readFile(sourceMetadata, 'utf8'), /^gitdir: \.\.\/\.git\/modules\/documentation-source\s*$/);
});

test('production document retrieval reads the canonical repository, not the local materialization', async () => {
  const adminApi = await readFile(new URL('../api/admin.js', import.meta.url), 'utf8');
  assert.match(
    adminApi,
    /const RAW_DOCUMENT_BASE = 'https:\/\/raw\.githubusercontent\.com\/LostLimbRider\/Autobiography\/master\/'/,
  );
  assert.match(adminApi, /fetch\(`\$\{RAW_DOCUMENT_BASE\}\$\{sourcePath\}`/);
  assert.doesNotMatch(adminApi, /readFile(?:Sync)?\([^\n]*documentation-source/);
});
