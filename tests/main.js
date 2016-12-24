'use strict';

const firebaseTest = require('../');
const context = require('../src/context');

describe('main', function() {
  let rules;

  beforeEach(function() {
    sinon.stub(context, 'create');

    Object.keys(firebaseTest.drivers).forEach(
      k => sinon.stub(firebaseTest.drivers[k], 'create')
    );

    rules = {};
  });

  afterEach(function() {
    context.create.restore();

    Object.keys(firebaseTest.drivers).forEach(
      k => firebaseTest.drivers[k].create.restore()
    );
  });

  describe('suite', function() {

    it('should create a context', function() {
      const ctx = {};

      context.create.returns(ctx);

      expect(firebaseTest.suite({rules})).to.equal(ctx);
      expect(context.create).to.have.been.calledWith(sinon.match({rules}));
    });

    it('should throw if rules are not provided', function() {
      expect(() => firebaseTest.suite()).to.throw();
      expect(() => firebaseTest.suite({})).to.throw();
      expect(() => firebaseTest.suite({rules})).to.not.throw();
    });

    it('should use simulated by default', function() {
      const driver = {};

      firebaseTest.drivers.simulated.create.returns(driver);
      firebaseTest.suite({rules});

      expect(context.create).to.have.been.calledWith(sinon.match({driver}));
    });

    it('should use provided driver', function() {
      const driver = {};

      firebaseTest.suite({rules, driver});

      expect(context.create).to.have.been.calledWith(sinon.match({driver}));
    });

  });

  describe('loadDriver', function() {

    it('should the driver using envinment variabled', function() {
      const driverInst = {};
      const driver = {create: sinon.stub().returns(driverInst)};
      const src = {
        FIREBASE_TEST_DRIVER_ID: 'foo',
        FIREBASE_TEST_DRIVER_ONE: 'bar',
        FIREBASE_TEST_DRIVER_TWO: 'baz'
      };

      firebaseTest.drivers.foo = driver;

      expect(firebaseTest.loadDriver({src})).to.equal(driverInst);
      expect(driver.create).to.have.been.calledOnce();
      expect(driver.create).to.have.been.calledWith({id: 'foo', one: 'bar', two: 'baz'});

      delete firebaseTest.drivers.foo;
    });

    it('should throw if the driver is unknown', function() {
      const src = {FIREBASE_TEST_DRIVER_ID: 'foo'};

      expect(() => firebaseTest.loadDriver({src})).to.throw();

      delete firebaseTest.drivers.foo;
    });

  });

});
