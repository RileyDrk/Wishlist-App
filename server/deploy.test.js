import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const bash = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : '/bin/bash'
const oldCommit = '1'.repeat(40)
const target = '2'.repeat(40)
const mocks = `
git() {
  printf 'git %s\\n' "$*" >> "$MOCK_LOG"
  case "$*" in
    'remote get-url origin') echo 'https://github.com/RileyDrk/Wishlist-App.git' ;;
    'rev-parse HEAD') echo '${oldCommit}' ;;
    'rev-parse origin/main') echo '${target}' ;;
    'diff --quiet') test "$DIRTY" = 0 ;;
    *) return 0 ;;
  esac
}
flock() { return 0; }
docker() {
  printf 'docker %s\\n' "$*" >> "$MOCK_LOG"
  case "$*" in
    inspect*new-container) echo 'sha256:new-image' ;;
    inspect*) echo 'sha256:old-image' ;;
    *'ps -aq app') echo old-container ;;
    *'ps -q app') echo new-container ;;
    *'config --format json') printf '%s\\n' '{"services":{"app":{"image":"wishlist-app:v1","build":{"context":"/fixture"}}}}' ;;
    *'build app') test "$FAIL_BUILD" = 0 ;;
    *'rollback.json'*'up -d'*) test "$FAIL_ROLLBACK" = 0 ;;
    *'up -d'*) test "$FAIL_REPLACE" = 0 ;;
    *) return 0 ;;
  esac
}
python3() {
  node -e 'const fs=require("fs");const p=process.argv[1];const d=JSON.parse(fs.readFileSync(p,"utf8"));d.services.app.image=process.argv[2];delete d.services.app.build;fs.writeFileSync(p,JSON.stringify(d))' "$2" "$3"
}
`

test('deployment script validates syntax and refuses running in the development checkout', { skip: !existsSync(bash) }, () => {
  const syntax = spawnSync(bash, ['-n', 'deploy.sh'], { encoding: 'utf8' })
  assert.equal(syntax.status, 0, syntax.stderr)
  const result = spawnSync(bash, ['deploy.sh', target], { encoding: 'utf8' })
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /Run deployment only in/)
})

for (const scenario of ['success', 'build failure', 'failed replacement', 'failed rollback', 'dirty checkout']) {
  test(`deployment handles ${scenario} without operating on real Git or Docker`, { skip: !existsSync(bash) }, async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'wishlist-deploy-test-'))
    try {
      const checkout = path.join(directory, 'checkout')
      await mkdir(path.join(checkout, '.git'), { recursive: true })
      await mkdir(path.join(checkout, 'deploy'))
      await writeFile(path.join(checkout, 'deploy/app.env'), '# fixture only\n')
      const original = await readFile('deploy.sh', 'utf8')
      // Only the fixture copy bypasses the production path guard. All commands
      // that could affect Git or Docker are shell functions in BASH_ENV.
      const fixture = original.replace(/  if \[\[ "\$root" != \/home\/riley-drake\/Projects\/wishlist\/app \]\]; then[\s\S]*?  fi\n/, '')
      assert.notEqual(fixture, original)
      await writeFile(path.join(checkout, 'deploy.sh'), fixture)
      await writeFile(path.join(directory, 'mocks.sh'), mocks)
      const log = path.join(directory, 'commands.log')
      const result = spawnSync(bash, ['deploy.sh', target], {
        cwd: checkout,
        encoding: 'utf8',
        env: { ...process.env, BASH_ENV: path.join(directory, 'mocks.sh').replaceAll('\\', '/'), MOCK_LOG: log.replaceAll('\\', '/'),
          FAIL_BUILD: scenario === 'build failure' ? '1' : '0',
          FAIL_REPLACE: ['failed replacement', 'failed rollback'].includes(scenario) ? '1' : '0',
          FAIL_ROLLBACK: scenario === 'failed rollback' ? '1' : '0',
          DIRTY: scenario === 'dirty checkout' ? '1' : '0',
        },
      })
      const commands = await readFile(log, 'utf8')
      assert.doesNotMatch(commands, /reset --hard|down|volume rm|prune/)
      assert.equal(result.status, scenario === 'success' ? 0 : 1, result.stderr)
      if (scenario === 'success') {
        assert.match(result.stdout, /Wishlist deployed successfully/)
        assert.match(commands, new RegExp(`git checkout --detach ${target}`))
        const snapshot = JSON.parse(await readFile(path.join(directory, '.wishlist-deploy/last-good.json'), 'utf8'))
        assert.equal(snapshot.services.app.image, 'sha256:new-image')
        assert.equal(snapshot.services.app.build, undefined)
      } else if (scenario === 'build failure') {
        assert.doesNotMatch(commands, /up -d/)
      } else if (scenario === 'failed replacement') {
        assert.match(commands, /rollback.json.*up -d/)
        assert.match(commands, new RegExp(`git checkout --detach ${oldCommit}`))
      } else if (scenario === 'failed rollback') {
        assert.match(result.stderr, /Automatic rollback also failed/)
      } else {
        assert.doesNotMatch(commands, /git fetch|docker /)
      }
    } finally {
      assert.equal(path.dirname(directory), path.resolve(tmpdir()))
      assert.ok(path.basename(directory).startsWith('wishlist-deploy-test-'))
      await rm(directory, { recursive: true, force: true })
    }
  })
}
