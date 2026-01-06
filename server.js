const express = require("express");
const QRCode = require("qrcode");
const archiver = require("archiver");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 5000;

/* -------------------- Middleware -------------------- */
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

/* -------------------- Helpers -------------------- */

// Auto-detect base URL (localhost or hosted)
const getBaseURL = (req) => {
  return process.env.BASE_URL || `${req.protocol}://${req.get("host")}`;
};

// Normalize URL (avoid localhost issues)
const normalizeURL = (url, baseURL) => {
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    return `${baseURL}/${url.replace(/^\/+/, "")}`;
  }
  return url;
};

/* -------------------- Health Check -------------------- */
app.get("/", (req, res) => {
  res.send("✅ Bulk QR Generator Backend Running");
});

/* -------------------- BULK QR (FAST) -------------------- */
app.post("/api/qr/bulk", async (req, res) => {
  const { urls } = req.body;

  if (!Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({ error: "URLs array required" });
  }

  if (urls.length > 100) {
    return res.status(400).json({ error: "Maximum 100 URLs allowed" });
  }

  try {
    const baseURL = getBaseURL(req);

    // PARALLEL QR GENERATION (NO SEQUENTIAL DELAY)
    const results = await Promise.all(
      urls.map((u, i) => {
        const finalURL = normalizeURL(u, baseURL);

        return QRCode.toDataURL(finalURL, {
          width: 300,
          errorCorrectionLevel: "M", // faster
          margin: 2
        }).then((qr) => ({
          name: `qr_${i + 1}.png`,
          url: finalURL,
          image: qr
        }));
      })
    );

    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "QR generation failed" });
  }
});

/* -------------------- ZIP DOWNLOAD (OPTIMIZED) -------------------- */
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

    // Generate buffers in parallel
    const buffers = await Promise.all(
      urls.map((u) =>
        QRCode.toBuffer(normalizeURL(u, baseURL), {
          width: 300,
          errorCorrectionLevel: "M",
          margin: 2
        })
      )
    );

    buffers.forEach((buffer, i) => {
      archive.append(buffer, { name: `qr_${i + 1}.png` });
    });

    await archive.finalize();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "ZIP generation failed" });
  }
});

/* -------------------- Start Server -------------------- */
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
