import { createReadStream, createWriteStream } from 'fs';
import { join, sep } from 'path';
import ffmpeg from 'ffmpeg-lambda-binary';
import fs from 'fs-extra';
import State from 'lambda-state';
import { S3 } from 'aws-sdk';

const stackTrace = e => (e.stack || []).split('\n').slice(1).map(l => l.trim().replace(/^at /, ''));

const decodeKey = key => decodeURIComponent(key).replace(/\+/g, ' ');

const dlPath = (key) => {
  const parts = key.split('/');
  return join(sep, 'tmp', parts[parts.length - 1]);
};

const convertObject = object =>
  ffmpeg(['-i', dlPath(object.movKey), '-c', 'copy', '-y', dlPath(object.mp4Key)])
    .then(() => object);

class S3Object {
  constructor(bucket, key) {
    this.bucket = bucket;
    this.movKey = decodeKey(key);
    this.mp4Key = this.movKey.replace(/\.mov$/, '.mp4');
  }

  deleteFiles() {
    return fs.remove(dlPath(this.movKey)).then(() => fs.remove(dlPath(this.mp4Key)));
  }
}

class MovToMp4 {
  constructor({ Records: records }) {
    this.s3 = new S3();
    this.records = records;
  }

  handle(callback) {
    return State.init()
      .then(State.info('S3 records', this.records))
      .then(this.getS3Records.bind(this))
      .then(State.info('S3 objects to process'))
      .then(this.processObjects.bind(this))
      .catch(e => State.error(e.name || 'Unknown error', { error: e.toString(), stack: stackTrace(e) })())
      .then(() => State.finalize(callback));
  }

  getS3Records() {
    return new Promise((resolve) => {
      resolve(this.records
        .filter(rec => /\.mov$/.test(decodeKey(rec.s3.object.key)))
        .map(rec => new S3Object(rec.s3.bucket.name, rec.s3.object.key)));
    });
  }

  processObjects(objects) {
    return Promise.all(objects.map(object =>
      State.info('Starting download', { object, path: dlPath(object.movKey) })(object)
        .then(this.downloadObject.bind(this))
        .then(State.info('Converting object'))
        .then(convertObject)
        .then(State.info('Uploading converted object'))
        .then(this.uploadConvertedObject.bind(this))
        .then(State.info('Removing object files'))
        .then(object.deleteFiles.bind(object))
        .catch(e => State.error(e.name || 'Unknown error', { error: e.toString(), stack: stackTrace(e) })())));
  }

  downloadObject(object) {
    return new Promise((resolve, reject) =>
      this.s3.getObject({ Bucket: object.bucket, Key: object.movKey })
        .on('error', reject)
        .createReadStream()
        .on('end', () => resolve(object))
        .on('error', reject)
        .pipe(createWriteStream(dlPath(object.movKey))));
  }

  uploadConvertedObject(object) {
    return this.s3.putObject({
      Bucket: object.bucket,
      Key: object.mp4Key,
      Body: createReadStream(dlPath(object.mp4Key)),
      ContentType: 'video/mp4'
    }).promise().then(() => object);
  }
}

exports.MovToMp4 = MovToMp4;
exports.handler = (event, context, callback) => new MovToMp4(event).handle(callback);
