import * as fs from 'fs-extra';
import * as path from 'path';

import { parseDocs } from '.';

console.time('generate');
parseDocs({
  baseDirectory: path.resolve(__dirname, '../../electron'),
  electronVersion: 'v4.0.1',
})
  .then(data =>
    fs.writeJson('./api.json', data, {
      spaces: 2,
    }),
  )
  .then(() => console.timeEnd('generate'))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
