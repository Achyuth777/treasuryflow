import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
// Build the existing public website and portable demo, then package them with the hosted API.
fs.rmSync('dist',{recursive:true,force:true});
await import('./build.mjs');
fs.mkdirSync('hosted/public',{recursive:true});
for(const name of ['app.js','app.css'])fs.copyFileSync('dist/'+name,'hosted/public/'+name);
execFileSync(process.platform==='win32'?'npm.cmd':'npm',['run','build'],{cwd:'hosted',stdio:'inherit'});
fs.rmSync('dist',{recursive:true,force:true});
fs.cpSync('hosted/dist','dist',{recursive:true});
