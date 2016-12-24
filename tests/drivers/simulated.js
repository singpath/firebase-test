'use strict';

const simulated = require('../../src/drivers/simulated');
const context = require('../../src/context');
const targaryen = require('targaryen');

describe('targaryen', function() {

  beforeEach(function() {
    sinon.spy(targaryen, 'ruleset');
    sinon.spy(targaryen, 'store');
    sinon.spy(targaryen, 'database');
  });

  afterEach(function() {
    targaryen.ruleset.restore();
    targaryen.store.restore();
    targaryen.database.restore();
  });

  describe('create', function() {

    it('should create a driver', function() {
      const driver = simulated.create();

      expect(driver.id).to.equal('targaryen');
      expect(driver).respondTo('init');
      expect(driver).respondTo('exec');
    });

    describe('#init', function() {

      it('should parse the rules', function() {
        const rules = {rules: {'.read': false}};
        const driver = simulated.create();

        driver.init({rules});
        expect(targaryen.ruleset).to.have.been.calledWith(rules);
      });

      it('should throw if the rules are invalid', function() {
        expect(() => simulated.create().init({rules: {}})).to.throw();
      });

    });

    describe('#exec', function() {

      it('should run operations in order using last operation resulting state', function() {
        const driver = simulated.create();
        const rules = {
          rules: {
            '.read': false,
            '.write': 'data.exists() == false'
          }
        };
        const ctx0 = context.create({rules, driver});
        const ctx1 = ctx0.set('foo', 1);
        const ctx2 = ctx1.set('foo', 2);

        expect(() => driver.exec(ctx0)).to.not.throw();
        expect(() => driver.exec(ctx1)).to.not.throw();
        expect(() => driver.exec(ctx2)).to.throw();
        expect(driver.exec(ctx1)).to.deep.equal({foo: 1});
      });

      it('should run operations using auth', function() {
        const driver = simulated.create();
        const rules = {
          rules: {
            '.read': 'auth.uid == "alice"'
          }
        };
        const ctx0 = context.create({rules, driver});
        const ctx1a = ctx0.get('foo');
        const ctx1b = ctx0.as('alice').get('foo');

        expect(() => driver.exec(ctx0)).to.not.throw();
        expect(() => driver.exec(ctx1a)).to.throw();
        expect(() => driver.exec(ctx1b)).to.not.throw();
      });

      it('should push element', function() {
        const driver = simulated.create();
        const rules = {
          rules: {
            $key: {
              '.write': true
            }
          }
        };
        const ctx0 = context.create({rules, driver});
        const ctx1a = ctx0.set('/', {foo: true, bar: true});
        const ctx1b = ctx0.push('/', true).push('/', true);

        expect(() => driver.exec(ctx0)).to.not.throw();
        expect(() => driver.exec(ctx1a)).to.throw();
        expect(() => driver.exec(ctx1b)).to.not.throw();

        let count = 0;
        const uniqID = () => `id${count++}`;

        expect(simulated.create({uniqID}).exec(ctx1b)).to.deep.equal({id0: true, id1: true});
      });

      it('should update multi-locations', function() {
        const driver = simulated.create();
        const rules = {
          rules: {
            foo: {'.write': false},
            $key: {'.write': true}
          }
        };

        const ctx0 = context.create({rules, driver});
        const ctx1a = ctx0.update('/', {foo: true, bar: true, baz: true});
        const ctx1b = ctx0.update('/', {bar: true, baz: true});

        expect(() => driver.exec(ctx0)).to.not.throw();
        expect(() => driver.exec(ctx1a)).to.throw();
        expect(() => driver.exec(ctx1b)).to.not.throw();

        expect(driver.exec(ctx1b)).to.deep.equal({bar: true, baz: true});
      });

      it('should throw when handling unknown operation type', function() {
        const driver = simulated.create();
        const rules = {rules: {}};
        const ctx = context.create({rules, driver});

        ctx.ops.push({op: 'bar'});

        expect(() => driver.exec(ctx)).to.throw();
      });

      it('should start evaluation with seed data', function() {
        const driver = simulated.create();
        const rules = {rules: {'.write': true}};
        const ctx0 = context.create({rules, driver}).startWith({foo: 1});
        const ctx1 = ctx0.set('bar', 2);

        expect(driver.exec(ctx1)).to.deep.equal({foo: 1, bar: 2});
      });

      it('should return the seed by default (no op to run)', function() {
        const driver = simulated.create();
        const seed = {foo: 1};
        const ctx = {seed};

        expect(driver.exec(ctx)).to.deep.equal(seed);
      });

      it('should log detail info', function() {
        const log = sinon.spy();
        const driver = simulated.create({log});
        const rules = {rules: {'.write': true}};
        const ctx = context.create({rules, driver}).set('bar', 2, {debug: true});

        driver.exec(ctx);

        expect(log).to.have.been.calledOnce();
        expect(log).to.have.been.calledWith(sinon.match(/write was allowed\./i));
      });

    });

  });

});
