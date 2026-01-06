const express = require("express");
const QRCode = require("qrcode");
const archiver = require("archiver");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 5000;

/* Middleware */
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

/* Auto-detect base URL */
const getBaseURL = (req) => {
  return (
    process.env.BASE_URL ||
    `${req.protocol}://${req.get("host")}`
  );
};

/* Normalize URL */
const normalizeURL = (url, baseURL) => {
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    return `${baseURL}/${url}`;
  }
  return url;
};

/* Health check */
app.get("/", (req, res) => {
  res.send("✅ Bulk QR Generator Backend Running");
});

/* Generate bulk QR (Base64) */
app.post("/api/qr/bulk", async (req, res) => {
  const { urls } = req.body;

  if (!Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({ error: "URLs array required" });
  }

  try {
    const baseURL = getBaseURL(req);
    const results = [];

    for (let i = 0; i < urls.length; i++) {
      const finalURL = normalizeURL(urls[i], baseURL);

      const qr = await QRCode.toDataURL(finalURL, {
        width: 300,
        errorCorrectionLevel: "M",
        margin: 2
      });

      results.push({
        name: `qr_${i + 1}.png`,
        url: finalURL,
        image: qr
      });
    }

    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "QR generation failed" });
  }
});

/* Download ZIP */
app.post("/api/qr/zip", async (req, res) => {
  const { urls } = req.body;

  if (!Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({ error: "URLs array required" });
  }

  try {
    const baseURL = getBaseURL(req);

    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=qr_codes.zip"
    );

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.pipe(res);

    for (let i = 0; i < urls.length; i++) {
      const finalURL = normalizeURL(urls[i], baseURL);

      const buffer = await QRCode.toBuffer(finalURL, {
        width: 300,
        errorCorrectionLevel: "M",
        margin: 2
      });

      archive.append(buffer, { name: `qr_${i + 1}.png` });
    }

    await archive.finalize();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "ZIP generation failed" });
  }
});

/* Start server */
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
