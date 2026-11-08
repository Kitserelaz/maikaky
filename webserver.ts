import express from "express";
import { startLinkedRoles } from "./linkedRoles.ts";
const app = express()
const port = 3000

app.get('/', (req, res) => {
  res.send('Hello World!')
})

await startLinkedRoles(app);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
