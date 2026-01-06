const express = require("express");
const QRCode = require("qrcode");
const archiver = require("archiver");
const cors = require("cors");

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

/* Health check */
app.get("/", (req, res) => {
  res.send("✅ Bulk QR Generator Backend Running");
});

/* Generate bulk QR and return base64 images */
app.post("/api/qr/bulk", async (req, res) => {
  const { urls } = req.body;

  if (!Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({ error: "URLs array required" });
  }

  try {
    const results = [];

    for (let i = 0; i < urls.length; i++) {
      const qr = await QRCode.toDataURL(urls[i], {
        width: 300,
        errorCorrectionLevel: "H"
      });

      results.push({
        name: `qr_${i + 1}.png`,
        url: urls[i],
        image: qr
      });
    }

    res.json(results);
  } catch (err) {
    res.status(500).json({ error: "QR generation failed" });
  }
});

/* Download ZIP */
app.post("/api/qr/zip", async (req, res) => {
  const { urls } = req.body;

  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", "attachment; filename=qr_codes.zip");

  const archive = archiver("zip");
  archive.pipe(res);

  for (let i = 0; i < urls.length; i++) {
    const buffer = await QRCode.toBuffer(urls[i], {
      width: 300,
      errorCorrectionLevel: "H"
    });
    archive.append(buffer, { name: `qr_${i + 1}.png` });
  }

  archive.finalize();
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
