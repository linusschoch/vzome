import esbuild from 'esbuild';
import { esbuildConfig } from './esbuild-config.mjs';

esbuild.serve({
  servedir: 'public',
  port: 8532,
}, { ...esbuildConfig, minify: false, sourcemap: true, outdir: 'public/modules' } );
