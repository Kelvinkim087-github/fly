// src/renderer.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";

// Choose one of these:
import App from "./App.jsx"; // Full app with auth
// import SimpleApp from './SimpleApp'; // Simple app without auth

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
	<React.StrictMode>
		<App /> {/* Change to <SimpleApp /> if you want the simple version */}
	</React.StrictMode>
);
