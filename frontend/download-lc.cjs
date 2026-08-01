const https = require('https')
const fs = require('fs')
const path = require('path')

const files = [
  { url: 'https://unpkg.com/lightweight-charts@4.1.0/dist/typings.d.ts', name: 'typings.d.ts' },
  { url: 'https://unpkg.com/lightweight-charts@4.1.0/dist/lightweight-charts.production.mjs', name: 'lightweight-charts.production.mjs' },
  { url: 'https://unpkg.com/lightweight-charts@4.1.0/dist/lightweight-charts.development.mjs', name: 'lightweight-charts.development.mjs' },
]

const dir = path.join(__dirname, 'node_modules', 'lightweight-charts', 'dist')
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true })
}

async function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest)
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`status ${res.statusCode}`))
        return
      }
      res.pipe(file)
      file.on('finish', () => {
        file.close()
        resolve()
      })
    }).on('error', reject)
  })
}

;(async () => {
  for (const f of files) {
    const dest = path.join(dir, f.name)
    console.log('Downloading', f.name)
    await download(f.url, dest)
    const stat = fs.statSync(dest)
    console.log('Saved', f.name, stat.size)
  }
  console.log('Done')
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
