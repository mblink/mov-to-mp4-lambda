const childProcess = {
  spawn: {
    stdout: { on: () => {} },
    stderr: { on: () => {} },
    on: (evt, callback) => { if (evt === 'close') { callback(0); } }
  }
};

const fsExtra = ['mkdirp', 'remove'];

const s3GetObject = {
  on: (evt, callback) => { if (evt === 'end') { callback(); } return s3GetObject; },
  createReadStream: () => s3GetObject,
  pipe: () => s3GetObject
};

const s3PutObject = { promise: () => Promise.resolve() };

const S3 = {
  getObject() { return s3GetObject; },
  putObject() { return s3PutObject; }
};

export { childProcess, fsExtra, S3, s3GetObject, s3PutObject };
