const path = require('path');

function dataDirectory() {
  return path.resolve(process.env.SCRIBEL_DATA_DIR || path.join(__dirname, '..', '..', 'data'));
}

module.exports = { dataDirectory };
