const httpServer = require('http-server');
const open = require('open');

const port = 8080;

const server = httpServer.createServer({
  // server options
});
server.listen(port, () => {
  console.log(`Server listening on port ${port}`);
  open(`http://localhost:${port}`);
});
