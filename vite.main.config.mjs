import { defineConfig } from "vite";

// https://vitejs.dev/config
export default defineConfig({
	build: {
		rollupOptions: {
			external: [
				"mongodb-client-encryption",
				"aws-crt",
				"snappy",
				"@aws-sdk/credential-providers",
				"@mongodb-js/zstd",
				"kerberos",
				"gcp-metadata",
			],
			output: {
				format: "cjs",
			},
		},
	},
	resolve: {
		// Some packages (like mongoose) might struggle with ESM imports in Electron without this
		mainFields: ["module", "jsnext:main", "jsnext"],
	},
});
