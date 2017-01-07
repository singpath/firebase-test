'use strict';

const q = require('../src/promise');

describe('promise', function() {

  describe('thenable', function() {

    it('should create a promise like object', function() {
      const thenable = q.thenable(() => {});

      expect(thenable).to.respondTo('then');
      expect(thenable).to.respondTo('catch');
    });

    it('should should work sync function', function() {
      const thenable = q.thenable(() => 1);

      expect(() => thenable.then()).to.not.throw();

      return thenable.then(v => expect(v).to.equal(1));
    });

    it('should should work async function', function() {
      const thenable = q.thenable(() => Promise.resolve(1));

      return thenable.then(v => expect(v).to.equal(1));
    });

    it('should could the source lazily', function() {
      const resolver = sinon.spy();
      const thenable1 = q.thenable(resolver);
      const thenable2 = q.thenable(resolver);

      expect(resolver).to.not.have.been.called();

      return thenable1.then(
        () => expect(resolver).to.have.been.calledOnce()
      ).then(
        () => thenable1
      ).then(
        // thenable1 should already resolved
        () => expect(resolver).to.have.been.calledOnce()
      ).then(
        () => thenable2
      ).then(
        // thenable1 is not resolved yet
        () => expect(resolver).to.have.been.calledTwice()
      );
    });

    describe('catch', function() {

      it('should catch rejecting resolver', function() {
        const err = new Error();
        const thenable = q.thenable(() => Promise.reject(err));

        return thenable.catch(e => expect(e).to.equal(err));
      });

    });

    describe('asCallback', function() {

      it('should resolve via a callback', function(done) {
        const thenable = q.thenable(() => 1);
        const cb = v => {
          expect(v).to.be.undefined();
          done();
        };

        thenable.asCallback(cb);
      });

      it('should reject via a callback', function(done) {
        const err = new Error();
        const thenable = q.thenable(() => Promise.reject(err));
        const cb = e => {
          expect(e).to.equal(err);
          done();
        };

        thenable.asCallback(cb);
      });

      it('should return a promise if no callback is provided', function() {
        const thenable = q.thenable(() => 1);

        expect(thenable.asCallback(() => {})).to.be.undefined();
        expect(thenable.asCallback()).to.equal(thenable);
      });

    });

  });

  describe('run', function() {

    it('should run thenable assertion', function() {
      const src = sinon.stub();

      src.returns(Promise.resolve());

      const result = q.run(
        q.thenable(src),
        q.thenable(src),
        q.thenable(src)
      );

      expect(src).to.not.have.been.called();

      return result.then(
        () => expect(src).to.have.callCount(3)
      );
    });

    it('should run them sequentially', function() {
      const src = {
        first: () => Promise.resolve().then(() => src.second()),
        second: () => {},
        third: () => Promise.resolve()
      };

      sinon.spy(src, 'first');
      sinon.spy(src, 'second');
      sinon.spy(src, 'third');

      const result = q.run(
        q.thenable(src.first),
        q.thenable(src.third)
      );

      return result.then(() => {
        expect(src.third).to.have.been.calledAfter(src.first);
        expect(src.third).to.have.been.calledAfter(src.second);
      });
    });

    it('should stop once a sequence fails', function() {
      const err = new Error();
      const ok = sinon.stub().returns(Promise.resolve());
      const fail = sinon.stub().returns(Promise.reject(err));

      return q.run(
        q.thenable(ok),
        q.thenable(fail),
        q.thenable(ok)
      ).then(
        () => Promise.reject(new Error('unexpected')),
        e => {
          expect(ok).to.have.callCount(1);
          expect(fail).to.have.callCount(1);
          expect(e).to.equal(err);
        }
      );
    });

  });

  describe('all', function() {

    it('should run thenable assertion', function() {
      const src = sinon.stub();

      src.returns(Promise.resolve());

      const result = q.all(
        q.thenable(src),
        q.thenable(src),
        q.thenable(src)
      );

      expect(src).to.not.have.been.called();

      return result.then(
        () => expect(src).to.have.callCount(3)
      );
    });

    it('should run them sequentially', function() {
      const src = {
        first: () => Promise.resolve().then(() => src.second()),
        second: () => {},
        third: () => Promise.resolve()
      };

      sinon.spy(src, 'first');
      sinon.spy(src, 'second');
      sinon.spy(src, 'third');

      const result = q.all(
        q.thenable(src.first),
        q.thenable(src.third)
      );

      return result.then(() => {
        expect(src.third).to.have.been.calledAfter(src.first);
        expect(src.third).to.have.been.calledAfter(src.second);
      });
    });

    it('should run all sequence even if one fails', function() {
      const err1 = new Error();
      const err2 = new Error();
      const ok = sinon.stub().returns(Promise.resolve());
      const fail = sinon.stub();

      fail.onCall(0).returns(Promise.reject(err1));
      fail.onCall(1).returns(Promise.reject(err2));

      return q.all(
        q.thenable(ok),
        q.thenable(fail),
        q.thenable(fail),
        q.thenable(ok)
      ).then(
        () => Promise.reject(new Error('unexpected')),
        () => {
          expect(ok).to.have.callCount(2);
          expect(fail).to.have.callCount(2);
        }
      );
    });

  });

});
