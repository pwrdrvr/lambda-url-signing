import { HttpRequest } from '@aws-sdk/protocol-http';
import { NodeHttpHandler } from '@aws-sdk/node-http-handler';
import getStream from 'get-stream';

const log = console;

/**
 * Send the request to the Lambda URL
 * @param presignedRequest
 */
export async function sendRequest(presignedRequest: HttpRequest, title: string) {
  log.info(`Sending ${title} request`);
  const client = new NodeHttpHandler();
  const { response } = await client.handle(presignedRequest);
  const responseNoBody = { headers: response.headers, statusCode: response.statusCode };
  log.info({ responseNoBody }, 'response without body');
  if (response.body) {
    log.info({ body: (await getStream(response.body)).slice(0, 2000) }, 'body preview');
  }
  log.info('------------------------------------\n');
}
