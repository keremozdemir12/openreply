// Runs the worker inside a free "web service" (e.g. Render's free tier), which
// must bind a port. An uptime pinger hitting this URL keeps it from sleeping.
import http from "node:http";
import "./dm-worker";

const port = Number(process.env.PORT ?? 10000);

http
  .createServer((_req, res) => {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("ok");
  })
  .listen(port, () => console.log(`[DM Worker] Health server on :${port}`));
