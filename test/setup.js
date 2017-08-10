import chai from 'chai';
import sinon from 'sinon';

global.expect = chai.expect;
chai.use(require('dirty-chai'));
chai.use(require('sinon-chai'));

const utils = { match: sinon.match };
const testFns = ['spy', 'stub', 'mock'];

beforeEach(() => {
  utils.sandbox = sinon.sandbox.create();
  Object.assign(utils, ...testFns.map(fn => ({ [fn]: utils.sandbox[fn].bind(utils.sandbox) })));
  if (process.env.ALLOW_CONSOLE !== 'true') { utils.stub(console, 'log'); }
});

afterEach(() => {
  utils.sandbox.restore();
  testFns.forEach(fn => delete utils[fn]);
});

export default utils;
