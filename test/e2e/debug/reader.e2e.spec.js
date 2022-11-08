import {fs, tempDir} from 'appium/support';
import path from 'node:path';
import {FileReader} from '../../../lib/debug/reader';
import unexpected from 'unexpected';

const expect = unexpected.clone();

const SOME_FILE_PATH = path.join(__dirname, 'fixture', 'some-file.txt');

describe('file reader behavior', function () {
  /** @type {string} */
  let tmpdir;

  /** @type {FileReader} */
  let reader;

  before(async function () {
    tmpdir = await tempDir.openDir();
    await fs.mkdirp(tmpdir);
  });

  after(async function () {
    await fs.rimraf(tmpdir);
  });

  afterEach(async function() {
    if (reader) {
      await reader.close();
    }
  });

  describe('reading an existing file', function () {
    it('should read the file', async function () {
      const actual = await fs.readFile(SOME_FILE_PATH, 'utf8');
      reader = new FileReader(SOME_FILE_PATH);
      await reader.open();
      await expect(reader.read(), 'to be fulfilled with', actual);
    });
  });

  describe('reading a file concurrently being written to', function() {
    it('should read the file', async function() {
      const filepath = path.join(tmpdir, 'some-other-file.txt');
      const fh = await fs.openFile(filepath, 'w+');
      try {
        reader = new FileReader(filepath);
        await reader.open();
        let data = '';
        await fh.write('foo\n');
        data += await reader.read();
        await fh.write('bar\n');
        data += await reader.read();
        await fh.write('baz\n');
        data += await reader.read();
        expect(data, 'to be', 'foo\nbar\nbaz\n');
      } finally {
        await fh.close();
      }
    });
  });

});
