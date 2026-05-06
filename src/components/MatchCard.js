// src/components/MatchCard.js
import React from "react";

const MatchCard = ({ match, date }) => {
  return (
    <div style={{
      border: "1px solid #ccc",
      borderRadius: "8px",
      padding: "10px",
      marginBottom: "10px"
    }}>
      <h3>{match}</h3>
      <p>{date}</p>
    </div>
  );
};

export default MatchCard;
