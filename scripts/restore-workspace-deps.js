#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const cwd = process.cwd();
const origPath = path.join(cwd, 'package.json.orig');
const pkgPath = path.join(cwd, 'package.json');

if (!fs.existsSync(origPath)) process.exit(0);
fs.copyFileSync(origPath, pkgPath);
fs.unlinkSync(origPath);
