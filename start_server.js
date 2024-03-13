const httpServer = require('http-server')
const port = 8080

const server = httpServer.createServer({
	// Server options
	cache: -1, // Disable caching for all files
	setHeaders: (res, filePath) => {
		if (filePath.endsWith('.jpg') || filePath.endsWith('.png') || filePath.endsWith('.gif')) {
			// Disable caching for image files
			res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
			res.setHeader('Pragma', 'no-cache')
			res.setHeader('Expires', '0')
		}
	},
})

server.listen(port, () => {
	console.log(`Server listening on port ${port}`)

	// Dynamically import the 'open' package
	import('open').then((open) => {
		open.default(`http://localhost:${port}`)
	}).catch(err => console.error('Failed to load the open module', err))
})