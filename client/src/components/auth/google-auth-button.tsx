import React from "react";

const GoogleButton: React.FC = () => {
  // Redirect user to Google OAuth login on button click
  const handleGoogleLogin = () => {
    window.location.href = "/api/auth/google";
  };

  return (
    <button
      type="button"
      onClick={handleGoogleLogin}
      style={{
        display: "flex",
        alignItems: "center",
        backgroundColor: "#4285F4",
        color: "white",
        border: "none",
        padding: "10px 16px",
        borderRadius: 4,
        cursor: "pointer",
        fontWeight: "bold",
      }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 533.5 544.3"
        style={{ width: 20, height: 20, marginRight: 8 }}
      >
        <path
          fill="#fff"
          d="M533.5 278.4c0-18.5-1.5-36.2-4.6-53.5H272v101.3h147.1c-6.3 33.7-25.3 62.3-54.2 81.5v67.9h87.5c51.3-47.3 80.1-117 80.1-199.2z"
        />
        <path
          fill="#4285F4"
          d="M272 544.3c73.6 0 135.5-24.3 180.7-65.8l-87.5-67.9c-24.1 16.1-54.9 25-93.1 25-71.6 0-132.2-48.4-154-113.3h-89.3v70.9C79.8 488 168.7 544.3 272 544.3z"
        />
        <path
          fill="#34A853"
          d="M118 324.8c-6-18-9.4-37.2-9.4-57s3.4-39 9.4-57v-70.9h-89.3C7 198.6 0 235.1 0 272s7 73.4 28.7 115.8l89.3-63z"
        />
        <path
          fill="#FBBC05"
          d="M272 107.7c39.9 0 75.7 13.7 103.9 41.1l77.9-77.9C398.1 24.4 335.7 0 272 0 168.7 0 79.8 56.3 28.7 140.9l89.3 70.9C139.8 156.1 200.4 107.7 272 107.7z"
        />
      </svg>
      Sign in with Google
    </button>
  );
};

export default GoogleButton;
