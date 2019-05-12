import { GitProcess } from 'dugite';
import * as semver from 'semver';
import * as fs from 'fs-extra';
import * as path from 'path';
import { chain } from 'lodash';

const gitDir = '/Users/codebytere/Developer/electron-gn/src/electron';
const dataPath = '/Users/codebytere/Developer/docs-parser/src/module-version-added.json';

export const fetchVersionAdded = async (docPath: string): Promise<string> => {
  let versionAdded: string = '';
  const file = await fs.readFile(dataPath);
  const json = JSON.parse(file.toString())

  // check to see if we've already historically-indexed this file
  if ((<any>json).docPath) {
    versionAdded = (<any>json).docPath
  } else {
    const { stdout } = await GitProcess.exec(['tag'], gitDir);
    let tags: any = chain(stdout.split('\n'))
      .map(line => line.trim())
      .compact()
      .value();
    tags = tags.sort(semver.compare);

    // fetch version history for comparison
    for (let tag of tags) {
      const firstTag = await checkExists(`cat-file -e ${tag}:${docPath}`)
      if (firstTag) {
        json.push({ docPath: firstTag });
        versionAdded = firstTag;
      }
    }

    // update the file
    await fs.writeFile(
      path.join(__dirname, dataPath),
      JSON.stringify(json, null, 2)
    )
  }

  return versionAdded;
}

async function checkExists(command: string): Promise<string | false> {
  const { stdout, exitCode } = await GitProcess.exec(command.split(' '), gitDir);

  if (exitCode !== 0) return false;
  return stdout;
}
