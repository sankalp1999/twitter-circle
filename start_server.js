const httpServer = require('http-server')

const port = 8080

const server = httpServer.createServer({
	// server options
})
server.listen(port, () => {
	console.log(`Server listening on port ${port}`)

	// Dynamically import the 'open' package
	import('open').then((open) => {
		open.default(`http://localhost:${port}`)
	}).catch(err => console.error('Failed to load the open module', err))
})
