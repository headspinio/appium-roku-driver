import RokuDriver from '../../lib/driver';

describe('driver tests', function () {
  it('should load the driver', function () {
    should.exist(RokuDriver);
  });
});
