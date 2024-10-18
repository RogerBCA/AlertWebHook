const express = require("express");
const app = express();

app.use(express.json());

app.post("/", (req, res) => {
  console.log(req.body);
  res.send("Recibido");
});

app.listen(3000, () => {
  console.log("Servidor escuchando en puerto 3000");
});
