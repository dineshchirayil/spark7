import path from 'path';
import fs from 'fs';
import tsconfigPaths from 'tsconfig-paths';

// Read tsconfig and register paths for runtime ESM resolution
const tsconfigPath = path.resolve(process.cwd(), 'tsconfig.json');
const tsconfigRaw = fs.readFileSync(tsconfigPath, 'utf8');
const tsconfig = JSON.parse(tsconfigRaw);
const baseUrl = path.resolve(process.cwd(), tsconfig.compilerOptions?.baseUrl || '.');
const sourcePaths = tsconfig.compilerOptions?.paths || {};

// When running compiled code from 'dist', map any 'src/...' path entries to 'dist/...'
const paths: Record<string, string[]> = {};
for (const [key, arr] of Object.entries(sourcePaths)) {
  paths[key] = Array.isArray(arr)
    ? arr.map((p) => {
        // If the path starts with 'src/', convert to dist. Otherwise resolve relative to baseUrl
        if (p.startsWith('src/')) {
          return path.resolve(process.cwd(), p.replace(/^src\//, 'dist/'));
        }
        return path.resolve(baseUrl, p);
      })
    : [];
}

tsconfigPaths.register({ baseUrl, paths });

// Import the compiled app (ESM)
import('./app.js')
  .then(() => {
    console.log('App imported via bootstrap');
  })
  .catch((err) => {
    console.error('Failed to import app via bootstrap:', err);
    process.exit(1);
  });