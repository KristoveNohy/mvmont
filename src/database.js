const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');

class Database {
  constructor(baseDir) {
    this.baseDir = baseDir;
  }

  collectionPath(name) {
    return path.join(this.baseDir, `${name}.json`);
  }

  async ensureCollection(name, initialValue = []) {
    const filePath = this.collectionPath(name);
    await fsp.mkdir(this.baseDir, { recursive: true });
    try {
      await fsp.access(filePath, fs.constants.F_OK);
    } catch {
      await fsp.writeFile(filePath, JSON.stringify(initialValue, null, 2));
    }
  }

  async read(name, fallback = []) {
    const filePath = this.collectionPath(name);
    try {
      const content = await fsp.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      if (error.code === 'ENOENT') {
        await this.ensureCollection(name, fallback);
        return fallback;
      }
      throw error;
    }
  }

  async write(name, data) {
    const filePath = this.collectionPath(name);
    await fsp.mkdir(this.baseDir, { recursive: true });
    await fsp.writeFile(filePath, JSON.stringify(data, null, 2));
  }
}

module.exports = Database;
