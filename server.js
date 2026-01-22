import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import pkg from "pg";
import axios from "axios";
import path from "path";

dotenv.config();
const { Pool } = pkg;

const app = express();
app.use(cors());
app.use(express.json());

/*--------------------------------
  DATABASE CONNECTION
--------------------------------*/
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

/*--------------------------------
  GITHUB CLIENT
--------------------------------*/
const github = axios.create({
  baseURL: "https://api.github.com",
  headers: {
    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`
  }
});

/*--------------------------------
  ADD NEW REPO — NO DUPLICATES
--------------------------------*/
app.post("/api/repos", async (req, res) => {
  const { team_name, github_username, repo_name } = req.body;

  try {
    const exists = await pool.query(
      `SELECT * FROM tracked_repos
       WHERE team_name=$1 AND github_username=$2 AND repo_name=$3`,
      [team_name, github_username, repo_name]
    );

    if (exists.rowCount > 0) {
      return res.json({ message: "Repo already tracked." });
    }

    await pool.query(
      "INSERT INTO tracked_repos (team_name, github_username, repo_name) VALUES ($1,$2,$3)",
      [team_name, github_username, repo_name]
    );

    res.json({ message: "Repository added successfully." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/*--------------------------------
  GRAPH DATA (TEAM + REPO GROUPED)
--------------------------------*/
app.get("/api/stats", async (_req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM tracked_repos");

    const dates = new Set();
    const map = {};

    const results = await Promise.all(
      rows.map(async r => {
        const { data } = await github.get(
          `/repos/${r.github_username}/${r.repo_name}/commits?per_page=100`
        );
        return { team: r.team_name, repo: r.repo_name, commits: data };
      })
    );

    results.forEach(r => {
      const key = `${r.team} (${r.repo})`;
      map[key] ??= {};

      r.commits.forEach(c => {
        const date = c.commit.author.date.slice(0, 10);
        dates.add(date);
        map[key][date] = (map[key][date] || 0) + 1;
      });
    });

    const labels = [...dates].sort();

    const datasets = Object.keys(map).map((team, i) => ({
      label: team,
      data: labels.map(d => map[team][d] || 0),
      borderColor: `hsl(${i * 45}, 90%, 60%)`,
      tension: 0.35,
      borderWidth: 3
    }));

    res.json({ labels, datasets });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/*--------------------------------
  AGGREGATED COMMIT TABLE
--------------------------------*/
app.get("/api/commits", async (_req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM tracked_repos");

    const results = await Promise.all(
      rows.map(async r => {
        const { data } = await github.get(
          `/repos/${r.github_username}/${r.repo_name}/commits?per_page=100`
        );

        const countMap = {};
        data.forEach(c => {
          const date = c.commit.author.date.slice(0, 10);
          countMap[date] = (countMap[date] || 0) + 1;
        });

        return Object.entries(countMap).map(([date, count]) => ({
          team: r.team_name,
          repo: r.repo_name,
          date,
          commit_count: count
        }));
      })
    );

    res.json(results.flat());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/*--------------------------------
  SERVE REACT BUILD
--------------------------------*/
app.use(express.static("build"));
app.get("*", (_, res) => res.sendFile(path.resolve("build", "index.html")));

const PORT = process.env.BACKEND_PORT || 5000;
app.listen(PORT, () => console.log(`🚀 GitPulse running on ${PORT}`));
