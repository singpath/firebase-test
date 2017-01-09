'use strict';

const test = require('../../');

// Using Mocha BDD
describe('firechat', function() {
  let suite;

  // The first live connection to firebase might timeout
  this.timeout(10000);

  beforeEach(function() {
    suite = test.suite({rules: require('./rules')});
  });

  it('should disallow read by default', function() {
    const moderators = {alice: true};

    return test.all(
      suite.get('/').shouldFail(),
      suite.as('bob').get('/').shouldFail(),
      suite.startWith({moderators}).as('alice').get('/').shouldFail()
    );
  });

  it('should disallow write by default', function() {
    const moderators = {alice: true};

    return test.all(
      suite.set('/', null).shouldFail(),
      suite.as('bob').set('/', null).shouldFail(),
      suite.startWith({moderators}).as('alice').set('/', null).shouldFail()
    );
  });

  describe('rooms', function() {

    it('can be listed', function() {
      return suite.get('/room-metadata').ok();
    });

    it('can be created by any authenticated user when they are public', function() {
      const roomId = '12345';
      const roomBy = createdByUserId => ({
        createdByUserId,
        id: roomId,
        name: 'some room',
        type: 'public'
      });

      return test.all(
        suite.set(`/room-metadata/${roomId}`, roomBy(null)).shouldFail(),
        suite.set(`/room-metadata/${roomId}`, roomBy('someone')).shouldFail(),
        suite.as('bob').set(`/room-metadata/${roomId}`, roomBy('bob')).ok()
      );
    });

    it('can be created by any authenticated user when they are private', function() {
      const roomId = '12345';
      const roomBy = createdByUserId => ({
        createdByUserId,
        id: roomId,
        name: 'some room',
        type: 'private'
      });

      return test.all(
        suite.set(`/room-metadata/${roomId}`, roomBy(null)).shouldFail(),
        suite.set(`/room-metadata/${roomId}`, roomBy('someone')).shouldFail(),
        suite.as('bob').set(`/room-metadata/${roomId}`, roomBy('bob')).ok()
      );
    });

    it('can only be created a moderator when they are official', function() {
      const ctx = suite.startWith({moderators: {alice: true}});
      const roomId = '12345';
      const officialRoom = () => ({
        id: roomId,
        name: 'some room',
        type: 'official'
      });

      return test.all(
        ctx.set(`/room-metadata/${roomId}`, officialRoom()).shouldFail(),
        ctx.set(`/room-metadata/${roomId}`, officialRoom()).shouldFail(),
        ctx.as('bob').set(`/room-metadata/${roomId}`, officialRoom()).shouldFail(),
        ctx.as('alice').set(`/room-metadata/${roomId}`, officialRoom()).ok()
      );
    });

    it('can be edited by their owner or a moderators', function() {
      const roomId = '12345';
      const ctx = suite.startWith({
        moderators: {alice: true},
        'room-metadata': {
          [roomId]: {
            createdByUserId: 'bob',
            id: roomId,
            name: 'some room',
            type: 'public'
          }
        }
      });

      return test.all(
        ctx.set(`/room-metadata/${roomId}/name`, 'some other name').shouldFail(),
        ctx.as('rob').set(`/room-metadata/${roomId}/name`, 'some other name').shouldFail(),
        ctx.as('bob').set(`/room-metadata/${roomId}/name`, 'some other name').ok(),
        ctx.as('alice').set(`/room-metadata/${roomId}/name`, 'some other name').ok()
      );
    });

    it('should allow their participant or moderators to authorize other user', function() {
      const roomId = '12345';
      const ctx = suite.startWith({
        moderators: {alice: true},
        'room-metadata': {
          [roomId]: {
            createdByUserId: 'bob',
            id: roomId,
            name: 'some room',
            type: 'private',
            authorizedUsers: {dave: true}
          }
        }
      });

      return test.all(
        ctx.set(`/room-metadata/${roomId}/authorizedUsers/rob`, true).shouldFail(),
        ctx.as('someBody').set(`/room-metadata/${roomId}/authorizedUsers/rob`, true).shouldFail(),
        ctx.as('rob').set(`/room-metadata/${roomId}/authorizedUsers/rob`, true).shouldFail(),
        ctx.as('dave').set(`/room-metadata/${roomId}/authorizedUsers/rob`, true).ok(),
        ctx.as('bob').set(`/room-metadata/${roomId}/authorizedUsers/rob`, true).ok(),
        ctx.as('alice').set(`/room-metadata/${roomId}/authorizedUsers/rob`, true).ok()
      );
    });

    describe('messages', function() {

      it('are public when the room is public', function() {
        const roomId = '12345';
        const ctx = suite.startWith({
          moderators: {alice: true},
          'room-metadata': {
            [roomId]: {
              createdByUserId: 'bob',
              id: roomId,
              name: 'some room',
              type: 'public'
            }
          }
        });

        return test.all(
          ctx.get(`/room-messages/${roomId}`).ok(),
          ctx.as('someBody').get(`/room-messages/${roomId}`).ok()
        );
      });

      it('can only be read by authorized user', function() {
        const roomId = '12345';
        const ctx = suite.startWith({
          moderators: {alice: true},
          'room-metadata': {
            [roomId]: {
              createdByUserId: 'bob',
              id: roomId,
              name: 'some room',
              type: 'private',
              authorizedUsers: {dave: true}
            }
          }
        });

        return test.all(
          ctx.get(`/room-messages/${roomId}`).shouldFail(),
          ctx.as('someBody').get(`/room-messages/${roomId}`).shouldFail(),
          ctx.as('bob').get(`/room-messages/${roomId}`).shouldFail(),
          ctx.as('alice').get(`/room-messages/${roomId}`).shouldFail(),
          ctx.as('dave').get(`/room-messages/${roomId}`).ok()
        );
      });

      it('can be added by any active user when the room is public', function() {
        const roomId = '12345';
        const ctx = suite.startWith({
          suspensions: {rob: true, kate: Date.now() - 1000},
          'room-metadata': {
            [roomId]: {
              createdByUserId: 'bob',
              id: roomId,
              name: 'some room',
              type: 'public'
            }
          }
        });
        const msg = userId => ({
          userId,
          name: userId,
          message: 'some message',
          timestamp: {'.sv': 'timestamp'}
        });

        return test.all(
          ctx.set(`/room-messages/${roomId}/someMessageId`, msg(null)).shouldFail(),
          ctx.as('rob').set(`/room-messages/${roomId}/someMessageId`, msg('rob')).shouldFail(),
          ctx.as('kate').set(`/room-messages/${roomId}/someMessageId`, msg('kate')).ok(),
          ctx.as('dave').set(`/room-messages/${roomId}/someMessageId`, msg('dave')).ok()
        );
      });

      it('can be added by any active authorized user when the room is private', function() {
        const roomId = '12345';
        const ctx = suite.startWith({
          moderators: {alice: true},
          suspensions: {rob: true},
          'room-metadata': {
            [roomId]: {
              createdByUserId: 'bob',
              id: roomId,
              name: 'some room',
              type: 'private',
              authorizedUsers: {dave: true, rob: true}
            }
          }
        });
        const msg = userId => ({
          userId,
          name: userId,
          message: 'some message',
          timestamp: {'.sv': 'timestamp'}
        });

        return test.all(
          ctx.set(`/room-messages/${roomId}/someMessageId`, msg(null)).shouldFail(),
          ctx.as('someBody').set(`/room-messages/${roomId}/someMessageId`, msg('rob')).shouldFail(),
          ctx.as('bob').set(`/room-messages/${roomId}/someMessageId`, msg('dave')).shouldFail(),
          ctx.as('rob').set(`/room-messages/${roomId}/someMessageId`, msg('rob')).shouldFail(),
          ctx.as('alice').set(`/room-messages/${roomId}/someMessageId`, msg('dave')).shouldFail(),
          ctx.as('dave').set(`/room-messages/${roomId}/someMessageId`, msg('dave')).ok()
        );
      });

      it('can be eddit by any moderator when the room is public', function() {
        const roomId = '12345';
        const ctx = suite.startWith({
          moderators: {alice: true},
          'room-metadata': {
            [roomId]: {
              createdByUserId: 'bob',
              id: roomId,
              name: 'some room',
              type: 'public'
            }
          },
          'room-messages': {
            [roomId]: {
              someMessageId: {
                userId: 'dave',
                name: 'dave',
                message: 'some message',
                timestamp: {'.sv': 'timestamp'}
              }
            }
          }
        });
        const url = `/room-messages/${roomId}/someMessageId/message`;

        return test.all(
          ctx.set(url, 'some other message').shouldFail(),
          ctx.as('someBody').set(url, 'some other message').shouldFail(),
          ctx.as('bob').set(url, 'some other message').shouldFail(),
          ctx.as('dave').set(url, 'some other message').shouldFail(),
          ctx.as('alice').set(url, 'some other message').ok()
        );
      });

      it('can be eddit by any authorized moderator when the room is private', function() {
        const roomId = '12345';
        const ctx = suite.startWith({
          moderators: {alice: true, dave: true},
          'room-metadata': {
            [roomId]: {
              createdByUserId: 'bob',
              id: roomId,
              name: 'some room',
              type: 'private',
              authorizedUsers: {alice: true}
            }
          },
          'room-messages': {
            [roomId]: {
              someMessageId: {
                userId: 'dave',
                name: 'dave',
                message: 'some message',
                timestamp: {'.sv': 'timestamp'}
              }
            }
          }
        });
        const url = `/room-messages/${roomId}/someMessageId/message`;

        return test.all(
          ctx.set(url, 'some other message').shouldFail(),
          ctx.as('someBody').set(url, 'some other message').shouldFail(),
          ctx.as('bob').set(url, 'some other message').shouldFail(),
          ctx.as('dave').set(url, 'some other message').shouldFail(),
          ctx.as('alice').set(url, 'some other message').ok()
        );
      });

    });

    describe('user list', function() {

      it('allow any one to append itself for any room', function() {
        const roomId = '12345';
        const ctx = suite.startWith({
          'room-metadata': {
            [roomId]: {
              createdByUserId: 'bob',
              id: roomId,
              name: 'some room',
              type: 'private'
            }
          }
        });

        return test.all(
          ctx.push(`/room-users/${roomId}/someId`, {id: 'someId', name: 'someOne'}).shouldFail(),
          ctx.as('dave').push(`/room-users/${roomId}/bob`, {id: 'bob', name: 'bob'}).shouldFail(),
          ctx.as('dave').push(`/room-users/${roomId}/dave`, {id: 'dave', name: 'dave'}).ok()
        );
      });

      it('allow moderators to remove users from rooms', function() {
        const roomId = '12345';
        const ctx = suite.startWith({
          moderators: {alice: true},
          'room-metadata': {
            [roomId]: {
              createdByUserId: 'bob',
              id: roomId,
              name: 'some room',
              type: 'private'
            }
          }
        });

        return test.all(
          ctx.set(`/room-users/${roomId}/someId`, null).shouldFail(),
          ctx.as('bob').set(`/room-users/${roomId}/dave`, null).shouldFail(),
          ctx.as('alice').set(`/room-users/${roomId}/dave`, null).ok()
        );
      });

      it('are readeable by anyone when the room are public', function() {
        const roomId = '12345';
        const ctx = suite.startWith({
          'room-metadata': {
            [roomId]: {
              createdByUserId: 'bob',
              id: roomId,
              name: 'some room',
              type: 'public'
            }
          }
        });

        return ctx.get(`/room-users/${roomId}`).ok();
      });

      it('can only be read by authorized users when the room is private', function() {
        const roomId = '12345';
        const ctx = suite.startWith({
          'room-metadata': {
            [roomId]: {
              createdByUserId: 'bob',
              id: roomId,
              name: 'some room',
              type: 'private',
              authorizedUsers: {dave: true}
            }
          }
        });

        return test.all(
          ctx.get(`/room-users/${roomId}`).shouldFail(),
          ctx.as('bob').get(`/room-users/${roomId}`).shouldFail(),
          ctx.as('dave').get(`/room-users/${roomId}`).ok()
        );
      });

    });

  });

  describe('/moderators', function() {

    it('should allow read by authenticated user', function() {
      return test.all(
        suite.get('/moderators').shouldFail(),
        suite.as('bob').get('/moderators').ok()
      );
    });

    it('should disallow write by anyone', function() {
      const moderators = {alice: true};

      return test.all(
        suite.set('/moderators/bob', true).shouldFail(),
        suite.as('bob').set('/moderators/bob', true).shouldFail(),
        suite.startWith({moderators}).as('alice').set('/moderators/bob', true).shouldFail()
      );
    });

  });

  describe('/suspensions', function() {

    it('should allow moderators to read them', function() {
      const moderators = {alice: true};

      return test.all(
        suite.get('/suspensions').shouldFail(),
        suite.as('bob').get('/suspensions').shouldFail(),
        suite.startWith({moderators}).as('alice').get('/suspensions').ok()
      );
    });

    it('should allow moderators to write them', function() {
      const moderators = {alice: true};

      return test.all(
        suite.set('/suspensions/bob', true).shouldFail(),
        suite.as('bob').set('/suspensions/bob', true).shouldFail(),
        suite.startWith({moderators}).as('alice').set('/suspensions/bob', true).ok()
      );
    });

  });

  describe('/user-names-online', function() {

    it('should be public', function() {
      return suite.get('/user-names-online').ok();
    });

    it('should disallow write of online list or a session list', function() {
      const moderators = {alice: true};

      return test.all(
        suite.set('/user-names-online', null).shouldFail(),
        suite.as('bob').set('/user-names-online', null).shouldFail(),
        suite.startWith({moderators}).as('alice').set('/user-names-online', null).shouldFail(),

        suite.set('/user-names-online/bob', null).shouldFail(),
        suite.as('bob').set('/user-names-online/bob', null).shouldFail(),
        suite.startWith({moderators}).as('alice').set('/user-names-online/bob', null).shouldFail()
      );
    });

    it('should allow a user to log his/her session', function() {
      const id = 'bob';
      const name = 'itsbob';
      const moderators = {alice: true};

      return test.all(
        suite.push(`/user-names-online/${name}`, {id, name}).shouldFail(),
        suite.as('bob').push(`/user-names-online/${name}`, {id, name}).ok(),
        suite.startWith({moderators}).as('alice').push(`/user-names-online/${name}`, {id, name}).shouldFail()
      );
    });

    it('should only allow a user to update its own session', function() {
      const id = 'bob';
      const name = 'itsbob';
      const sessionId = 12345;
      const moderators = {alice: true};
      const ctx = suite.startWith({
        moderators,
        'user-names-online': {
          [name]: {
            [sessionId]: {
              id,
              name
            }
          }
        }
      });

      return test.all(
        ctx.set(`/user-names-online/${name}/${sessionId}/name`, 'Bobby').shouldFail(),
        ctx.as('bob').set(`/user-names-online/${name}/${sessionId}/name`, 'Bobby').ok(),
        ctx.as('alice').set(`/user-names-online/${name}/${sessionId}/name`, 'Bobby').shouldFail()
      );
    });

    it('should allow any authenticate user to delete any session', function() {
      const id = 'bob';
      const name = 'itsbob';
      const sessionId = 12345;
      const ctx = suite.startWith({
        'user-names-online': {
          [name]: {
            [sessionId]: {
              id,
              name
            }
          }
        }
      });

      return test.all(
        ctx.set(`/user-names-online/${name}/${sessionId}`, null).shouldFail(),
        ctx.as('bob').set(`/user-names-online/${name}/${sessionId}`, null).ok(),
        ctx.as('alice').set(`/user-names-online/${name}/${sessionId}`, null).ok()
      );
    });

  });

  describe('/users', function() {

    it('should allow a user to register', function() {
      const id = 'bob';
      const name = 'Bobby';

      return suite.as(id).set('/users/bob', {id, name}).ok();
    });

    it('should allow user data read by the user or a moderator', function() {
      const id = 'bob';
      const name = 'Bobby';
      const ctx = suite.startWith({
        users: {[id]: {id, name}},
        moderators: {alice: true}
      });

      return test.all(
        ctx.get('/users/bob/name').shouldFail(),
        ctx.as(id).get('/users/bob/name').ok(),
        ctx.as('alice').get('/users/bob/name').ok()
      );
    });

    it('should allow user data update by the user or a moderator', function() {
      const id = 'bob';
      const name = 'Bobby';
      const ctx = suite.startWith({
        users: {[id]: {id, name}},
        moderators: {alice: true}
      });

      return test.all(
        ctx.set('/users/bob/name', 'bob').shouldFail(),
        ctx.as(id).set('/users/bob/name', 'bob').ok(),
        ctx.as('alice').set('/users/bob/name', 'bob').ok()
      );
    });

    it('should allow moderators to notify user', function() {
      const ctx = suite.startWith({
        users: {bob: {id: 'bob', name: 'Bobby'}},
        moderators: {alice: true}
      });
      const notification = fromUserId => ({
        fromUserId,
        timestamp: {'.sv': 'timestamp'},
        notificationType: 'info',
        data: 'foo'
      });

      return test.all(
        ctx.push('/users/bob/notifications', notification('rob')).shouldFail(),
        ctx.as('rob').push('/users/bob/notifications', notification('rob')).shouldFail(),
        ctx.as('alice').push('/users/bob/notifications', notification('alice')).ok()
      );
    });

    it('should allow any authenticated user to send invitations', function() {
      const ctx = suite.startWith({
        users: {bob: {id: 'bob', name: 'Bobby'}}
      });
      const inviteId = '12345';
      const inviteFrom = fromUserId => ({
        fromUserId,
        id: inviteId,
        fromUserName: 'someOne',
        roomId: 'someId'
      });

      return test.all(
        ctx.set(`/users/bob/invites/${inviteId}`, inviteFrom('rob')).shouldFail(),
        ctx.as('rob').set(`/users/bob/invites/${inviteId}`, inviteFrom('rob')).ok()
      );
    });

    it('should allow invitation sender to read it', function() {
      const inviteId = '12345';
      const ctx = suite.startWith({
        users: {
          bob: {
            id: 'bob',
            name: 'Bobby',
            invites: {
              [inviteId]: {
                fromUserId: 'rob',
                id: inviteId,
                fromUserName: 'someOne',
                roomId: 'someId'
              }
            }
          }
        }
      });

      return test.all(
        ctx.get(`/users/bob/invites/${inviteId}`).shouldFail(),
        ctx.as('bill').get(`/users/bob/invites/${inviteId}`).shouldFail(),
        ctx.as('rob').get(`/users/bob/invites/${inviteId}`).ok()
      );
    });

  });

});
