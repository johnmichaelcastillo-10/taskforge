import { promisify } from 'node:util'
import { brotliCompress, constants, gzip } from 'node:zlib'

const brotli = promisify(brotliCompress)
const gzipAsync = promisify(gzip)

// Compresses rendered pages. Static files are compressed at build time (compressPublicAssets),
// but the Node server sends HTML as it renders it. Quick settings: pages are rendered per
// request, so speed matters more than the last few bytes.
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('render:response', async (response, { event }) => {
    if (typeof response.body !== 'string' || response.body.length < 1024 || response.headers?.['content-encoding']) {
      return
    }
    const accepted = getRequestHeader(event, 'accept-encoding') ?? ''
    const encoding = /\bbr\b/.test(accepted) ? 'br' : /\bgzip\b/.test(accepted) ? 'gzip' : null
    if (!encoding) {
      return
    }
    const body = encoding === 'br'
      ? await brotli(response.body, { params: { [constants.BROTLI_PARAM_QUALITY]: 4 } })
      : await gzipAsync(response.body, { level: 6 })
    response.body = body as unknown as string
    response.headers = { ...response.headers, 'content-encoding': encoding, 'vary': 'Accept-Encoding' }
  })
})
