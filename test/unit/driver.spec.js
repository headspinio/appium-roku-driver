import {RokuDriver} from '../../lib/driver';
import unexpected from 'unexpected';

const expect = unexpected.clone();

describe('driver tests', function () {
  it('should load the driver', function () {
    expect(RokuDriver, 'to be defined');
  });
});
