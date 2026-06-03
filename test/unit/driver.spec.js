import path from 'path';
import RokuDriver from '../../lib/driver';
import fs from 'node:fs/promises';

const FIXTURES = path.resolve(__dirname, '..', 'fixtures');

async function getPlayerXml(filename) {
  return await fs.readFile(path.resolve(FIXTURES, filename), {encoding: 'utf-8'});
}

describe('driver tests', function () {
  it('should load the driver', function () {
    should.exist(RokuDriver);
  });

  it('should correctly parse media player state', async function() {
    const d = new RokuDriver({});
    const playerXml = await getPlayerXml('media-player-1.xml');
    // mock ecp to return xml
    d.rokuEcp = function () { return {data: playerXml}; };
    const state = await d.roku_playerState();
    state.should.eql({
      player: {state: 'play', error: 'false'},
      plugin: {id: 'dev', name: 'Channel', bandwidth: '4812230 bps'},
      format: {audio: 'aac', video: 'mpeg4_10b', captions: 'webvtt', drm: 'widevine', container: 'dash'},
      buffering: {target: '0', max: '1000', current: '1000'},
      new_stream: {speed: '128000 bps'},
      position: '12012 ms',
      duration: '10570977 ms',
      is_live: {blocked: 'false', _value: 'false'},
      stream_segment: {media_sequence: '2', time: '8008', bitrate: '545869', segment_type: 'video', width: '480', height: '202'},
    });
  });

  it('should expose raw ecp command via executeRoku', async function () {
    const d = new RokuDriver({});
    d.rokuEcp = function (url, method, body) {
      url.should.eql('/query/device-info');
      method.should.eql('GET');
      body.should.eql('');
      return {data: '<device-info />'};
    };

    const res = await d.executeRoku('ecp', {url: '/query/device-info', method: 'GET'});
    res.should.eql('<device-info />');
  });

  it('should validate raw ecp command arguments', async function () {
    const d = new RokuDriver({});
    await d.executeRoku('ecp', {url: 'query/device-info'}).should.eventually.be.rejectedWith(
      /must start with '\//
    );
  });

  it('should long-press a key using keydown and keyup', async function () {
    const d = new RokuDriver({});
    const urls = [];
    d.rokuEcp = function (url) {
      urls.push(url);
      return {data: ''};
    };

    await d.executeRoku('longPress', {key: 'Select', durationMs: 0});
    urls.should.eql(['/keydown/Select', '/keyup/Select']);
  });

  it('should validate long-press arguments', async function () {
    const d = new RokuDriver({});
    await d.executeRoku('longPress', {key: 1}).should.eventually.be.rejectedWith(
      /key must be a string/
    );
    await d.executeRoku('longPress', {key: 'Select', durationMs: -1}).should.eventually.be.rejectedWith(
      /durationMs must be a non-negative number/
    );
  });
});
