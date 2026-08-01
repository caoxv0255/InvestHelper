const { execSync } = require('child_process')
try {
  execSync('npx tsc --noEmit', { cwd: 'frontend', stdio: 'inherit' })
} catch (e) {
  process.exit(1)
}
