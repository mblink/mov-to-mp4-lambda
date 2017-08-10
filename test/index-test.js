import AWS from 'aws-sdk';
import cp from 'child_process';
import fs from 'fs';
import fse from 'fs-extra';
import path from 'path';
import State from 'lambda-state';
import event from './event.json';
import { childProcess, fsExtra, S3, s3GetObject, s3PutObject } from './stubs';
import { MovToMp4, handler } from '../src/index';
import utils from './setup';

describe('handler', () => {
  let callback;

  const assertCallback = () => {
    expect(callback).to.have.been.calledOnce();
    expect(callback.firstCall.args[0]).to.be.null();
    expect(callback.firstCall.args[1].trace).to.have.lengthOf(6);
    expect(callback.firstCall.args[1].level).to.equal('info');
  };

  const assertErrorCallback = () => {
    expect(callback).to.have.been.calledOnce();
    expect(callback).to.have.been.calledWithExactly(utils.match.object);
  };

  const mkRecord = key => ({ s3: { bucket: { name: 'test' }, object: { key } } });

  beforeEach(() => {
    State.ensureInit();
    callback = utils.stub();
    utils.stub(AWS, 'S3').returns(S3);
    ['createReadStream', 'createWriteStream'].forEach(f => utils.stub(fs, f));
    fsExtra.forEach(f => utils.stub(fse, f).resolves());
    Object.keys(childProcess).forEach(k => utils.stub(cp, k).returns(childProcess[k]));
  });

  describe('filtering records', () => {
    it('filters on records with .mov extension', () => {
      utils.spy(MovToMp4.prototype, 'processObjects');
      return handler({ Records: [mkRecord('test.mov'), mkRecord('test.txt')] }, {}, callback).then(() => {
        assertCallback();
        expect(MovToMp4.prototype.processObjects).to.have.been.calledOnce();
        expect(MovToMp4.prototype.processObjects.firstCall.args[0][0].movKey).to.equal('test.mov');
      });
    });
  });

  describe('getting objects', () => {
    it('gets objects from S3', () => {
      utils.spy(S3, 'getObject');
      utils.spy(s3GetObject, 'createReadStream');
      utils.spy(s3GetObject, 'pipe');
      return handler(event, {}, callback).then(() => {
        assertCallback();
        expect(S3.getObject).to.have.been.calledOnce();
        expect(s3GetObject.createReadStream).to.have.been.calledOnce();
        expect(s3GetObject.pipe).to.have.been.calledOnce();
      });
    });
  });

  describe('converting objects', () => {
    it('shells out to ffmpeg', () =>
      handler(event, {}, callback).then(() => {
        assertCallback();
        expect(cp.spawn).to.have.been.calledOnce();
        expect(cp.spawn.firstCall.args[0]).to.match(/\/ffmpeg$/);
      }));

    it('uses the movKey as the input file', () =>
      handler(event, {}, callback).then(() => {
        assertCallback();
        expect(cp.spawn).to.have.been.calledOnce();
        expect(cp.spawn.firstCall.args[1][0]).to.equal('-i');
        expect(cp.spawn.firstCall.args[1][1]).to.equal(path.join(path.sep, 'tmp', 'test.mov'));
      }));

    it('copies the codec to the output file', () =>
      handler(event, {}, callback).then(() => {
        assertCallback();
        expect(cp.spawn).to.have.been.calledOnce();
        expect(cp.spawn.firstCall.args[1][2]).to.equal('-c');
        expect(cp.spawn.firstCall.args[1][3]).to.equal('copy');
      }));

    it('overwrites the output file if necessary', () =>
      handler(event, {}, callback).then(() => {
        assertCallback();
        expect(cp.spawn).to.have.been.calledOnce();
        expect(cp.spawn.firstCall.args[1][4]).to.equal('-y');
      }));

    it('uses the mp4Key as the output file', () =>
      handler(event, {}, callback).then(() => {
        assertCallback();
        expect(cp.spawn).to.have.been.calledOnce();
        expect(cp.spawn.firstCall.args[1][5]).to.equal(path.join(path.sep, 'tmp', 'test.mp4'));
      }));
  });

  describe('uploading objects', () => {
    it('puts objects to S3', () => {
      utils.spy(S3, 'putObject');
      utils.spy(s3PutObject, 'promise');
      return handler(event, {}, callback).then(() => {
        assertCallback();
        expect(S3.putObject).to.have.been.calledOnce();
        expect(s3PutObject.promise).to.have.been.calledOnce();
        expect(S3.putObject.firstCall.args[0].Bucket).to.equal('test-bucket');
        expect(S3.putObject.firstCall.args[0].Key).to.equal('test.mp4');
      });
    });
  });

  describe('deleting files', () => {
    it('deletes the .mov file', () =>
      handler(event, {}, callback).then(() => {
        assertCallback();
        expect(fse.remove).to.have.been.called();
        expect(fse.remove).to.have.been.calledWith(path.join(path.sep, 'tmp', 'test.mov'));
      }));

    it('deletes the .mp4 file', () =>
      handler(event, {}, callback).then(() => {
        assertCallback();
        expect(fse.remove).to.have.been.called();
        expect(fse.remove).to.have.been.calledWith(path.join(path.sep, 'tmp', 'test.mp4'));
      }));
  });

  describe('error handling', () => {
    beforeEach(() => utils.stub(console, 'error'));

    [
      ['State.init', [State, 'init']],
      ['State.info', [State, 'info'], s => s.returns(() => Promise.reject(new Error('State.info error')))],
      [
        'S3.getObject',
        [s3GetObject, 'on'],
        s => s.callsArgWith(1, new Error('S3.getObject error'))
      ],
      ['S3.putObject', [s3PutObject, 'promise']]
    ].forEach(([name, fn, genStub]) => it(`handles failure when calling ${name}`, () => {
      if (typeof genStub === 'function') {
        genStub(utils.stub(...fn));
      } else {
        utils.stub(...fn).returns(Promise.reject(new Error(`${name} error`)));
      }

      return handler(event, {}, callback).then(() => {
        assertErrorCallback();
        expect(fn[0][fn[1]]).to.have.been.called();
      });
    }));
  });
});
