const express = require("express");
var io = require("socket.io")(http);
const app = express();

var http = require("http").Server(app);
var io = require("socket.io")(http);

app.use(express.json());
app.use("/assets", express.static(__dirname + "/public"));

app.get("/", function (req, res) {
  res.sendFile(__dirname + "/html/index.html");
});

app.post("/1", (req, res) => {
  console.log(req.body);
  io.emit("reproducir", { count: 1 });
  res.send("Recibido");
});

app.post("/2", (req, res) => {
  console.log(req.body);
  io.emit("reproducir", { count: 1 });
  res.send("Recibido");
});

http.listen(3000, () => {
  console.log("Servidor escuchando en puerto 3000");
});
