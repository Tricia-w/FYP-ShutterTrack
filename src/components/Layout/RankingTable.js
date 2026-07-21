// src/components/RankingTable.js
import React from "react";

const RankingTable = () => {
  const players = [
    { name: "Alice", rank: 1 },
    { name: "Bob", rank: 2 },
    { name: "Charlie", rank: 3 }
  ];

  return (
    <table border="1" cellPadding="10" style={{ marginTop: "10px" }}>
      <thead>
        <tr>
          <th>Rank</th>
          <th>Player</th>
        </tr>
      </thead>
      <tbody>
        {players.map((p) => (
          <tr key={p.rank}>
            <td>{p.rank}</td>
            <td>{p.name}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default RankingTable;
