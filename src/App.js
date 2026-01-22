import { useEffect, useState } from "react";
import axios from "axios";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Legend
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, Legend);

export default function App() {
  const [form, setForm] = useState({
    team_name: "",
    github_username: "",
    repo_name: ""
  });

  const [chart, setChart] = useState(null);
  const [commits, setCommits] = useState([]);

  const load = async () => {
    const stats = await axios.get("/api/stats");
    const commitData = await axios.get("/api/commits");

    // Sort table by date desc
    commitData.data.sort((a, b) => b.date.localeCompare(a.date));

    setChart(stats.data);
    setCommits(commitData.data);
  };

  useEffect(() => {
    load();
  }, []);

  const submit = async e => {
    e.preventDefault();
    await axios.post("/api/repos", form);
    setForm({ team_name: "", github_username: "", repo_name: "" });
    load();
  };

  return (
    <div className="min-h-screen p-8 mx-auto max-w-5xl">

      {/* Title */}
      <h1 className="text-4xl text-center mb-10 font-bold text-[#4cc9f0]">
        GitPulse Dashboard
      </h1>

      {/* Form */}
      <div className="glass card">
        <h2 className="text-xl mb-4 font-semibold">Track a New Repository</h2>

        <form onSubmit={submit} className="space-y-4">
          {Object.keys(form).map(key => (
            <input
              key={key}
              className="w-full bg-transparent border p-3 rounded-md"
              placeholder={key.replace("_", " ")}
              value={form[key]}
              onChange={e => setForm({ ...form, [key]: e.target.value })}
              required
            />
          ))}

          <button className="button w-full">Track Repository</button>
        </form>
      </div>

      {/* Graph */}
      <div className="glass card">
        <h2 className="text-xl mb-4 font-semibold">Commit Activity Graph</h2>
        {chart && <Line data={chart} />}
      </div>

      {/* Table */}
      <div className="glass card">
        <h2 className="text-xl mb-3 font-semibold">Commit Summary (Aggregated)</h2>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Team</th>
                <th>Repo</th>
                <th>Date</th>
                <th>Commits</th>
              </tr>
            </thead>
            <tbody>
              {commits.map((c, index) => (
                <tr key={index}>
                  <td>{c.team}</td>
                  <td>{c.repo}</td>
                  <td>{c.date}</td>
                  <td className="font-bold text-[#4cc9f0]">{c.commit_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
