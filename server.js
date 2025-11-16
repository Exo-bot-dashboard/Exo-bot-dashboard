"scripts": {
  "build": "vite build",
  "start": "node server.js"
}
const express = require("express");
const path = require("path");
const app = express();

const PORT = process.env.PORT || 3000;

// Serve built React files
app.use(express.static(path.join(__dirname, "dist")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

// Example OAuth2 callback route
app.get("/callback", (req, res) => {
  res.send("OAuth2 callback received!");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
