import crypto from 'crypto';
import request from 'request-promise';
import log from './logger';

const AUTH_HEADER_RE = /(nonce|realm|qop)="([^"]+)"/;

export function md5 (str) {
  return crypto.createHash('md5').update(str).digest('hex');
}

export function randHex (len) {
  return crypto.randomBytes(len / 2).toString('hex');
}

export function getAuthHeader (digestParts) {
  const {user, realm, pass, method, uri, nonce, qop} = digestParts;
  const _hash1 = [user, realm, pass].join(':');
  const hash1 = md5(_hash1);
  const _hash2 = [method, uri].join(':');
  const hash2 = md5(_hash2);
  const nonceCount = '00000001';
  const cNonce = randHex(8);
  const _response = [hash1, nonce, nonceCount, cNonce, qop, hash2].join(':');
  const response = md5(_response);
  return `Digest username="${user}", realm="${realm}", nonce="${nonce}", uri="${uri}", cnonce="${cNonce}", nc="${nonceCount}", qop="${qop}", response="${response}"`;
}

export async function getAuthDigestParts (url, method) {
  const reqOpts = {
    resolveWithFullResponse: true,
    simple: false,
    method,
    url
  };
  log.info(`Getting auth header info from '${method} ${url}'`);
  const res = await request(reqOpts);
  if (!res.headers['www-authenticate']) {
    throw new Error(`Could not get auth header nonce from Roku web server`);
  }
  const authDigestParts = res.headers['www-authenticate'].split(',');
  const sanitizedParts = {};
  for (const rawPart of authDigestParts) {
    const match = rawPart.match(AUTH_HEADER_RE);
    if (!match[1] || !match[2]) {
      continue;
    }
    sanitizedParts[match[1]] = match[2];
  }
  return sanitizedParts;
}

