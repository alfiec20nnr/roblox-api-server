const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// -----------------------------
// 🧠 IN-MEMORY STORAGE
// -----------------------------
let searchHistory = [];
let favorites = new Set();

// Roblox API base (FIXED: HTTPS)
const ROBLOX_API = "https://catalog.roblox.com/v1/search/items";

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
      cursor
    } = req.query;

    // -----------------------------
    // 🧠 IMPROVED SEARCH HISTORY
    // -----------------------------
    if (keyword && keyword.trim().length > 1) {
      const normalized = keyword.trim().toLowerCase();

      // Remove duplicates
      searchHistory = searchHistory.filter(
        item => item.keyword !== normalized
      );

      // Add to front
      searchHistory.unshift({
        keyword: normalized,
        timestamp: Date.now()
      });

      // Keep only last 10
      searchHistory = searchHistory.slice(0, 10);
    }

    // -----------------------------
    // 🔧 BUILD PARAMS
    // -----------------------------
    let params = {
      keyword,
      category,
      creatorName: creator,
      minPrice,
      maxPrice,
      limit: 30,
      cursor
    };

    // Free filter
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

    // Remove undefined params (FIX)
    Object.keys(params).forEach(
      key => params[key] === undefined && delete params[key]
    );

    const response = await axios.get(ROBLOX_API, { params });

    let data = response.data.data;

    // -----------------------------
    // 🧪 ADVANCED FILTERING
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

// 🔥 FIXED: Batch request instead of multiple calls
app.get("/favorites", async (req, res) => {
  try {
    const ids = Array.from(favorites);

    if (ids.length === 0) return res.json([]);

    const response = await axios.post(
      "https://catalog.roblox.com/v1/catalog/items/details",
      {
        items: ids.map(id => ({
          itemType: "Asset",
          id: parseInt(id)
        }))
      }
    );

    res.json(response.data.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------
// 🎯 RECOMMENDATIONS (FIXED)
// -----------------------------
app.get("/recommendations", async (req, res) => {
  try {
    let keywords = [];

    // Use recent searches (top 3)
    if (searchHistory.length > 0) {
      keywords = searchHistory.slice(0, 3).map(s => s.keyword);
    }

    // Use favorites signal (basic boost)
    if (favorites.size > 0) {
      keywords.push("limited", "rare");
    }

    // Fallback keywords
    if (keywords.length === 0) {
      keywords = ["hat", "shirt", "accessory"];
    }

    // Random keyword for variation
    const keyword =
      keywords[Math.floor(Math.random() * keywords.length)];

    const response = await axios.get(ROBLOX_API, {
      params: {
        keyword,
        sortType: 3,
        limit: 20
      }
    });

    res.json({
      basedOn: keyword,
      results: response.data.data
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
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
