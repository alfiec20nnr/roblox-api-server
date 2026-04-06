const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// In-memory storage (replace with DB in production)
let searchHistory = [];
let favorites = new Set();

// Roblox API base
const ROBLOX_API = "http://catalog.roblox.com/v1/search/items";

// -----------------------------
// 🔍 SEARCH ENDPOINT
// -----------------------------
app.get("/search", async (req, res) => {
  try {
    const {
      keyword,
      category,
      creator,
      minPrice,
      maxPrice,
      free,
      limited,
      sortType,
      sortAggregation,
      include,
      exclude,
      cursor,
      saveHistory // 👈 new param
    } = req.query;

    // -----------------------------
    // 🧠 Save search history (optional)
    // -----------------------------
    const shouldSaveHistory = saveHistory !== "false"; 
    // default = true unless explicitly false

    if (keyword && shouldSaveHistory) {
      searchHistory.unshift(keyword);
      searchHistory = [...new Set(searchHistory)].slice(0, 10);
    }

    // Build query params
    let params = {
      keyword,
      category,
      creatorName: creator,
      minPrice,
      maxPrice,
      limit: 100,
      cursor
    };

    // Free items filter
    if (free === "true") {
      params.minPrice = 0;
      params.maxPrice = 0;
    }

    // Limited filter
    if (limited === "true") {
      params.salesTypeFilter = "2";
    }

    // Sorting
    if (sortType) params.sortType = sortType;
    if (sortAggregation) params.sortAggregation = sortAggregation;

    const response = await axios.get(ROBLOX_API, { params });

    let data = response.data.data;

    // -----------------------------
    // 🧪 Advanced Filtering
    // -----------------------------
    if (include) {
      const includeTerms = include.split(",");
      data = data.filter(item =>
        includeTerms.every(term =>
          item.name.toLowerCase().includes(term.toLowerCase())
        )
      );
    }

    if (exclude) {
      const excludeTerms = exclude.split(",");
      data = data.filter(item =>
        excludeTerms.every(term =>
          !item.name.toLowerCase().includes(term.toLowerCase())
        )
      );
    }

    res.json({
      results: data,
      nextCursor: response.data.nextPageCursor
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------
// 🕘 SEARCH HISTORY
// -----------------------------
app.get("/history", (req, res) => {
  res.json(searchHistory);
});

// -----------------------------
// ⭐ FAVORITES
// -----------------------------
app.post("/favorite/:id", (req, res) => {
  favorites.add(req.params.id);
  res.json({ success: true });
});

app.delete("/favorite/:id", (req, res) => {
  favorites.delete(req.params.id);
  res.json({ success: true });
});

app.get("/favorites", async (req, res) => {
  try {
    const ids = Array.from(favorites);

    const requests = ids.map(id =>
      axios.get(`https://catalog.roblox.com/v1/catalog/items/${id}/details`)
    );

    const results = await Promise.all(requests);

    res.json(results.map(r => r.data));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------
// 🎯 RECOMMENDATIONS
// -----------------------------
app.get("/recommendations", async (req, res) => {
  try {
    // Simple recommendation: based on last search
    const lastSearch = (searchHistory && searchHistory[0]) ? searchHistory[0] : "popular";

    const response = await axios.get(ROBLOX_API, {
      params: {
        keyword: lastSearch,
        sortType: "1", // relevance/popular
        limit: 20
      }
    });

    res.json(response.data.data);
  } catch (err) {
  console.error("Recommendation error:", err.response?.data || err.message);

  res.status(500).json({ 
    error: err.message,
    details: err.response?.data
  });
}
});

// -----------------------------
// 🔎 SEARCH BY ID
// -----------------------------
app.get("/item/:id", async (req, res) => {
  try {
    const response = await axios.get(
      `https://catalog.roblox.com/v1/catalog/items/${req.params.id}/details`
    );

    res.json(response.data);
  } catch (err) {
    res.status(404).json({ error: "Item not found" });
  }
});

// -----------------------------
// 🚀 START SERVER
// -----------------------------
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
