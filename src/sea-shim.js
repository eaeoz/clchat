var fs = require('fs');
var path = require('path');

var embeddedData = globalThis.__SEA_USR_DATA__;
if (!embeddedData) return;

var exeDir = path.dirname(process.execPath);

var fileMap = {};
var dirMap = {};

Object.keys(embeddedData).forEach(function (key) {
  var buf = Buffer.from(embeddedData[key], 'base64');
  var sep = key.replace(/\//g, path.sep);
  var fullPath = path.resolve(exeDir, '..', 'usr' + path.sep + sep);
  fileMap[path.normalize(fullPath)] = buf;

  var parts = sep.split(path.sep);
  for (var i = 1; i <= parts.length; i++) {
    var dirPath = path.resolve(exeDir, '..', 'usr' + path.sep + parts.slice(0, i).join(path.sep));
    dirPath = path.normalize(dirPath);
    if (!dirMap[dirPath]) dirMap[dirPath] = [];
    if (i < parts.length) {
      dirMap[dirPath].push(parts[i]);
    }
  }
});

function resolveEmbedded(p) {
  var norm = path.normalize(p);
  if (fileMap[norm]) return fileMap[norm];
  return null;
}

function isEmbeddedDir(p) {
  var norm = path.normalize(p);
  if (dirMap[norm]) return dirMap[norm];
  return null;
}

var origReadFileSync = fs.readFileSync;
var origExistsSync = fs.existsSync;
var origStatSync = fs.statSync;
var origReaddirSync = fs.readdirSync;

fs.readFileSync = function (filePath, options) {
  var data = resolveEmbedded(filePath);
  if (data) {
    if (typeof options === 'string' || (options && options.encoding)) {
      return data.toString('utf8');
    }
    return data;
  }
  return origReadFileSync.call(fs, filePath, options);
};

fs.existsSync = function (filePath) {
  if (resolveEmbedded(filePath)) return true;
  if (isEmbeddedDir(filePath)) return true;
  return origExistsSync.call(fs, filePath);
};

fs.statSync = function (filePath) {
  var data = resolveEmbedded(filePath);
  if (data) {
    return {
      isFile: function () { return true; },
      isDirectory: function () { return false; },
      isSymbolicLink: function () { return false; },
      size: data.length,
      mtime: new Date(0)
    };
  }
  var entries = isEmbeddedDir(filePath);
  if (entries) {
    return {
      isFile: function () { return false; },
      isDirectory: function () { return true; },
      isSymbolicLink: function () { return false; },
      size: 0,
      mtime: new Date(0)
    };
  }
  return origStatSync.call(fs, filePath);
};

fs.readdirSync = function (dirPath) {
  var entries = isEmbeddedDir(dirPath);
  if (entries) return entries;
  return origReaddirSync.call(fs, dirPath);
};
