module.exports = function rateLimit({ windowMs = 15 * 60 * 1000, max = 20 } = {}) {
  const hits = new Map();

  return (req, res, next) => {
    const key = req.ip || req.headers["x-forwarded-for"] || "unknown";
    const now = Date.now();
    const recent = (hits.get(key) || []).filter((t) => now - t < windowMs);

    if (recent.length >= max) {
      return res.status(429).json({
        message: "Too many attempts. Please wait a few minutes and try again.",
      });
    }

    recent.push(now);
    hits.set(key, recent);
    next();
  };
};
