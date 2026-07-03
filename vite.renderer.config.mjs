import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
	plugins: [react()],
	root: "./",
	base: "./",
	// No explicit `server.middlewareMode` here — let the plugin start a normal
	// Vite dev server so `server.listen` can be used during `electron-forge start`.
	build: {
		emptyOutDir: true,
		sourcemap: false,
		minify: "esbuild",
		target: "esnext",
		cssCodeSplit: false,
		rollupOptions: {
			input: path.resolve(__dirname, "index.html"),
			output: {
				entryFileNames: "[name].js",
				chunkFileNames: "[name].js",
				assetFileNames: "[name][extname]",
			},
		},
	},
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
});
