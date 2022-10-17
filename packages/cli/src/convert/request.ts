import { HttpRequest } from '@aws-sdk/protocol-http';
import { convertQuery } from './query';

export function convertRequest(url: URL) {
  const request = new HttpRequest({
    hostname: url.hostname,
    headers: {
      host: url.hostname,
      // TODO: Copy in the headers
    },
    method: 'GET',
    path: url.pathname,
    port: 443,
    protocol: 'https:',
  });

  request.query = convertQuery(url.searchParams);

  return request;
}
